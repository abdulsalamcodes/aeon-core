import { sql as raw } from "drizzle-orm";
import { db } from "./client.js";
import { organizations, schools } from "./schema/index.js";
import { runWithTenant } from "../tenant/context.js";
import { provisionService } from "../modules/identity/index.js";
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
  await runWithTenant({ schoolId: school!.id, orgId: org!.id }, () =>
    provisionService.addPrincipal({
      email: "admin@demo.aeon",
      password: "Demo-Pass-123",
      firstName: "Demo",
      lastName: "Admin",
      role: "school-admin",
    }),
  );
  logger.info({ login: "admin@demo.aeon" }, "seeded demo org/school/admin");
}
