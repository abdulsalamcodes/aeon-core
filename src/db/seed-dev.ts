import { sql as raw } from "drizzle-orm";
import { db } from "./client.js";
import { organizations, schools, terms } from "./schema/index.js";
import { runWithTenant, withTenant } from "../tenant/context.js";
import { provisionService } from "../modules/identity/index.js";
import { studentService } from "../modules/people/index.js";
import { classService } from "../modules/classes/index.js";
import { logger } from "../config/logger.js";

/**
 * Seeds a demo org/school/admin so an embedded run is immediately usable.
 * Idempotent: does nothing if any organization already exists.
 *
 * Demo credentials: admin@demo.aeon / Demo-Pass-123
 */
export async function seedDev(): Promise<void> {
  const existing = await db.execute(raw`select count(*)::int as n from organizations`);
  const rows = (Array.isArray(existing) ? existing : (existing as { rows?: unknown[] }).rows ?? []) as { n: number }[];
  if ((rows[0]?.n ?? 0) > 0) return;

  const [org] = await db.insert(organizations).values({ name: "Demo Academy Group", slug: "demo" }).returning();
  const [school] = await db
    .insert(schools)
    .values({ orgId: org!.id, name: "Demo Academy", slug: "demo-academy" })
    .returning();

  await provisionService.ensureSystemRoles();
  const tenant = { schoolId: school!.id, orgId: org!.id };

  await runWithTenant(tenant, async () => {
    await provisionService.addPrincipal({
      email: "admin@demo.aeon",
      password: "Demo-Pass-123",
      firstName: "Demo",
      lastName: "Admin",
      role: "school-admin",
    });

    // A term + a couple of classes + a few students, so the cutover pages
    // (People, Students, Classes) show real data immediately.
    await withTenant((tx) =>
      tx.insert(terms).values({ schoolId: school!.id, orgId: org!.id, name: "First Term", isCurrent: true }),
    );
    await classService.create({ name: "JSS 1A" });
    await classService.create({ name: "JSS 1B" });
    const demoStudents = [
      { firstName: "Tomi", lastName: "Adeyemi", gender: "female" as const, studentNumber: "STU-001", dob: "2012-03-04", guardianName: "Mrs Adeyemi", guardianPhone: "+2348030000001" },
      { firstName: "Chidi", lastName: "Okafor", gender: "male" as const, studentNumber: "STU-002", dob: "2011-09-21", guardianName: "Mr Okafor", guardianPhone: "+2348030000002" },
      { firstName: "Aisha", lastName: "Bello", gender: "female" as const, studentNumber: "STU-003", dob: "2012-01-15", guardianName: "Alhaji Bello", guardianPhone: "+2348030000003" },
    ];
    for (const s of demoStudents) await studentService.create(s);
  });

  logger.info({ login: "admin@demo.aeon" }, "seeded demo org/school/admin + classes + students");
}
