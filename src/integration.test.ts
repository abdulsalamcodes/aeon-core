import { describe, it, expect, beforeAll } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, sql } from "./db/client.js";
import { applyMigrations } from "./db/run-migrations.js";
import {
  organizations,
  schools,
  terms,
  classes,
  persons,
  outboxEvents,
  attendance,
  notifications,
  feeStructures,
} from "./db/schema/index.js";
import { runWithTenant, withTenant } from "./tenant/context.js";
import { provisionService } from "./modules/identity/index.js";
import { authService } from "./modules/identity/index.js";
import { enrollmentService } from "./modules/people/index.js";
import { onStudentEnrolled as academicsRipple } from "./modules/academics/index.js";
import { onStudentEnrolled as financeRipple } from "./modules/finance/index.js";
import { onStudentEnrolled as notifyRipple } from "./modules/notifications/index.js";
import { financeService } from "./modules/finance/index.js";
import { registerDefaultProviders } from "./payments/index.js";
import { registerDefaultChannels } from "./notifications/index.js";

let orgId: string;
let schoolId: string;
let termId: string;
let classId: string;
let studentId: string;

const tenant = () => ({ schoolId, orgId });

beforeAll(async () => {
  registerDefaultProviders();
  registerDefaultChannels();

  // 1) Migrate the embedded database (schema + RLS DDL).
  await applyMigrations();

  // 2) Seed an org + school (global / direct).
  const [org] = await db.insert(organizations).values({ name: "Greenfield Group", slug: "gf" }).returning();
  orgId = org!.id;
  const [school] = await db.insert(schools).values({ orgId, name: "GF Lekki", slug: "gf-lekki" }).returning();
  schoolId = school!.id;

  await provisionService.ensureSystemRoles();

  // 3) Provision a school-admin (account + person + membership) in the tenant.
  await runWithTenant(tenant(), () =>
    provisionService.addPrincipal({
      email: "admin@gf.test",
      password: "Sup3r-Secret!",
      firstName: "Ada",
      lastName: "Admin",
      role: "school-admin",
    }),
  );

  // 4) Seed a term, class, a default fee, and a student person.
  await runWithTenant(tenant(), async () => {
    await withTenant(async (tx) => {
      const [term] = await tx.insert(terms).values({ schoolId, orgId, name: "First Term", isCurrent: true }).returning();
      termId = term!.id;
      const [cls] = await tx.insert(classes).values({ schoolId, orgId, name: "JSS1A" }).returning();
      classId = cls!.id;
      const [student] = await tx.insert(persons).values({ schoolId, orgId, firstName: "Tomi", lastName: "Pupil" }).returning();
      studentId = student!.id;
      await tx.insert(feeStructures).values({
        schoolId, orgId, termId, name: "Tuition", amountMinor: 5_000_00, currency: "NGN", isDefault: true,
      });
    });
  });
});

describe("end-to-end: auth → enrolment ripple → idempotent payment", () => {
  it("logs in with a JWT bound to the school-admin membership", async () => {
    const res = await authService.login({ email: "admin@gf.test", password: "Sup3r-Secret!" });
    expect(res.accessToken).toBeTruthy();
    expect(res.active.role).toBe("school-admin");
    expect(res.active.schoolId).toBe(schoolId);
  });

  it("rejects a wrong password", async () => {
    await expect(authService.login({ email: "admin@gf.test", password: "nope" })).rejects.toThrow();
  });

  it("enrolling a student writes the enrollment AND a StudentEnrolled outbox event (same txn)", async () => {
    const enrollment = await runWithTenant(tenant(), () =>
      enrollmentService.enroll({ studentId, classId, termId }),
    );
    expect(enrollment.studentId).toBe(studentId);

    const events = await db
      .select()
      .from(outboxEvents)
      .where(and(eq(outboxEvents.aggregate, "enrollment"), eq(outboxEvents.eventType, "StudentEnrolled")));
    expect(events.length).toBe(1);
    expect(events[0]!.payload.studentId).toBe(studentId);
  });

  it("the ripple: one event drives attendance + fee + notification across three modules", async () => {
    const [evt] = await db.select().from(outboxEvents).where(eq(outboxEvents.eventType, "StudentEnrolled"));
    const payload = evt!.payload;

    await academicsRipple(payload); // seed attendance register
    await financeRipple(payload); // bill the default term fee
    await notifyRipple(payload); // SMS the guardian

    const reg = await runWithTenant(tenant(), () =>
      withTenant((tx) => tx.select().from(attendance).where(eq(attendance.studentId, studentId))),
    );
    expect(reg.length).toBe(1);

    const balances = await runWithTenant(tenant(), () => financeService.balanceFor(studentId, termId));
    const ngn = balances.find((b) => b.currency === "NGN");
    expect(ngn?.billedMinor).toBe(5_000_00);
    expect(ngn?.balanceMinor).toBe(5_000_00);

    const notes = await runWithTenant(tenant(), () =>
      withTenant((tx) => tx.select().from(notifications)),
    );
    expect(notes.length).toBeGreaterThanOrEqual(1);
    expect(notes[0]!.channel).toBe("sms");
  });

  it("a replayed payment webhook nets exactly one credit (idempotency, ADR-8)", async () => {
    const pay = () =>
      runWithTenant(tenant(), () =>
        financeService.recordPayment({
          studentId, termId, amountMinor: 2_000_00, currency: "NGN",
          idempotencyKey: "evt_dup_123", method: "transfer",
        }),
      );
    const a = await pay();
    const b = await pay(); // replay
    expect(a.id).toBe(b.id); // same entry, not a second credit

    const balances = await runWithTenant(tenant(), () => financeService.balanceFor(studentId, termId));
    const ngn = balances.find((b) => b.currency === "NGN");
    expect(ngn?.paidMinor).toBe(2_000_00); // one payment, not two
    expect(ngn?.balanceMinor).toBe(3_000_00); // 5000 billed − 2000 paid
  });

  it("cleans up", async () => {
    await sql.end();
    expect(true).toBe(true);
  });
});
