import { sql as raw } from "drizzle-orm";
import { db } from "./client.js";
import { organizations, schools, accounts } from "./schema/index.js";
import { runWithTenant } from "../tenant/context.js";
import { hashPassword } from "../auth/password.js";
import { provisionService } from "../modules/identity/index.js";
import { studentService, enrollmentService } from "../modules/people/index.js";
import { classService } from "../modules/classes/index.js";
import { subjectService } from "../modules/subjects/index.js";
import { termService } from "../modules/academic/index.js";
import { financeService } from "../modules/finance/index.js";
import { gradeService, attendanceService } from "../modules/academics/index.js";
import { calendarService, timetableService } from "../modules/schedule/index.js";
import { logger } from "../config/logger.js";

/**
 * Seeds a demo school with real data across every module so an embedded run is
 * immediately usable end-to-end. Idempotent: no-ops if an org already exists.
 *
 * Logins:
 *   staff/admin   admin@demo.aeon       / Demo-Pass-123   at /s/demo-academy
 *   student       STU-001 + 2012-03-04                    at /t/demo-academy
 *   super-admin   superadmin@aeon.app   / Super-Pass-123  at /login
 */
export async function seedDev(): Promise<void> {
  const existing = await db.execute(raw`select count(*)::int as n from organizations`);
  const rows = (Array.isArray(existing) ? existing : (existing as { rows?: unknown[] }).rows ?? []) as { n: number }[];
  if ((rows[0]?.n ?? 0) > 0) return;

  const [org] = await db.insert(organizations).values({ name: "Demo Academy Group", slug: "demo" }).returning();
  const [school] = await db.insert(schools).values({ orgId: org!.id, name: "Demo Academy", slug: "demo-academy" }).returning();
  await provisionService.ensureSystemRoles();
  await db.insert(accounts).values({ email: "superadmin@aeon.app", passwordHash: await hashPassword("Super-Pass-123"), isSuperAdmin: true });

  const today = new Date().toISOString().slice(0, 10);

  await runWithTenant({ schoolId: school!.id, orgId: org!.id }, async () => {
    await provisionService.addPrincipal({ email: "admin@demo.aeon", password: "Demo-Pass-123", firstName: "Demo", lastName: "Admin", role: "school-admin" });

    const term = await termService.create({ name: "First Term", isCurrent: true });
    const maths = await subjectService.create({ name: "Mathematics" });
    await subjectService.create({ name: "English" });
    const jss1a = await classService.create({ name: "JSS 1A" });
    await classService.create({ name: "JSS 1B" });

    const fee = await financeService.createFeeStructure({ termId: term.id, name: "Tuition", amountMinor: 5_000_00, currency: "NGN", isDefault: true });

    const demo = [
      { firstName: "Tomi", lastName: "Adeyemi", gender: "female" as const, studentNumber: "STU-001", dob: "2012-03-04", guardianName: "Mrs Adeyemi", guardianPhone: "+2348030000001", ca: 32, exam: 54 },
      { firstName: "Chidi", lastName: "Okafor", gender: "male" as const, studentNumber: "STU-002", dob: "2011-09-21", guardianName: "Mr Okafor", guardianPhone: "+2348030000002", ca: 28, exam: 48 },
      { firstName: "Aisha", lastName: "Bello", gender: "female" as const, studentNumber: "STU-003", dob: "2012-01-15", guardianName: "Alhaji Bello", guardianPhone: "+2348030000003", ca: 35, exam: 58 },
    ];

    for (const s of demo) {
      const student = await studentService.create(s);
      // Enrol → emits StudentEnrolled (activity feed). Then bill the fee, record
      // a grade, and mark the register, so every page has live data.
      await enrollmentService.enroll({ studentId: student.id, classId: jss1a.id, termId: term.id });
      await financeService.assignFee({ studentId: student.id, feeStructureId: fee.id });
      await gradeService.record({ studentId: student.id, subjectId: maths.id, termId: term.id, caScore: s.ca, examScore: s.exam });
      await attendanceService.bulkMark({ classId: jss1a.id, termId: term.id, date: today, records: [{ studentId: student.id, status: "present" }] });
    }

    // One partial payment so balances vary.
    const tomi = await studentService.list();
    const t = tomi.find((x) => x.studentNumber === "STU-001");
    if (t) await financeService.recordPayment({ studentId: t.id, termId: term.id, amountMinor: 2_000_00, currency: "NGN", idempotencyKey: "seed-tomi-1", method: "cash" });

    await calendarService.create({ title: "Mid-term Break", description: "Two-day break", startDate: today, endDate: today, type: "holiday" });
    await timetableService.upsert({
      classId: jss1a.id,
      termId: term.id,
      schedule: [{ day: "Monday", periods: [{ subjectId: maths.id, subjectName: "Mathematics", startTime: "08:00", endTime: "09:00" }] }],
    });
  });

  logger.info({ login: "admin@demo.aeon" }, "seeded demo school with full data");
}
