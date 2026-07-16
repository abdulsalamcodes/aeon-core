import { eq, and, isNull } from "drizzle-orm";
import { db } from "../../db/client.js";
import { roles, persons, memberships, organizations, schools } from "../../db/schema/index.js";
import { currentTenant, runWithTenant, withTenant } from "../../tenant/context.js";
import { authService } from "./auth.service.js";

const slugify = (value: string) =>
  value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** Finds an unused school slug, suffixing `-2`, `-3`… on collision. */
async function uniqueSchoolSlug(name: string): Promise<string> {
  const base = slugify(name) || "school";
  let candidate = base;
  let attempt = 1;
  while ((await db.select({ id: schools.id }).from(schools).where(eq(schools.slug, candidate)).limit(1)).length > 0) {
    attempt += 1;
    candidate = `${base}-${attempt}`;
  }
  return candidate;
}

/** System role names seeded once, globally (schoolId = null). */
export const SYSTEM_ROLES = ["super-admin", "school-admin", "teacher", "student", "guardian"] as const;
export type SystemRole = (typeof SYSTEM_ROLES)[number];

export const provisionService = {
  /** Idempotently ensure the system roles exist. Run on bootstrap. */
  async ensureSystemRoles(): Promise<void> {
    for (const name of SYSTEM_ROLES) {
      const existing = await db
        .select({ id: roles.id })
        .from(roles)
        .where(and(eq(roles.name, name), isNull(roles.schoolId)))
        .limit(1);
      if (existing.length === 0) {
        await db.insert(roles).values({ name, isSystem: true, permissions: [] });
      }
    }
  },

  /**
   * Provisions a principal in the CURRENT tenant: creates the global account,
   * the tenant-owned person, and a membership binding them to a system role.
   * This is the onboarding primitive People/Admissions build on.
   */
  async addPrincipal(params: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: SystemRole;
    orgWide?: boolean;
    emailVerified?: boolean;
  }): Promise<{ accountId: string; personId: string; membershipId: string }> {
    const { schoolId, orgId } = currentTenant();

    // 1) Global login identity (outside tenant).
    const account = await authService.createAccount(params.email, params.password, params.emailVerified ?? true);

    // 2) Resolve the system role id (global).
    const [role] = await db
      .select({ id: roles.id })
      .from(roles)
      .where(and(eq(roles.name, params.role), isNull(roles.schoolId)))
      .limit(1);
    if (!role) throw new Error(`System role '${params.role}' not seeded`);

    // 3) Tenant-owned person + membership in one transaction.
    return withTenant(async (tx) => {
      const [person] = await tx
        .insert(persons)
        .values({ schoolId, orgId, accountId: account.id, firstName: params.firstName, lastName: params.lastName })
        .returning({ id: persons.id });
      if (!person) throw new Error("Failed to create person");

      const [membership] = await tx
        .insert(memberships)
        .values({
          schoolId,
          orgId,
          accountId: account.id,
          personId: person.id,
          roleId: role.id,
          roleName: params.role,
          orgWide: params.orgWide ? "on" : "off",
        })
        .returning({ id: memberships.id });
      if (!membership) throw new Error("Failed to create membership");

      return { accountId: account.id, personId: person.id, membershipId: membership.id };
    });
  },

  /**
   * Creates a brand-new school with its own org and a school-admin principal —
   * the shared primitive behind both assisted onboarding and self-service
   * signup. The school's slug is derived from its name and de-duplicated.
   */
  async provisionSchool(params: {
    schoolName: string;
    adminName: string;
    adminEmail: string;
    adminPassword: string;
    emailVerified: boolean;
  }): Promise<{ schoolId: string; orgId: string; slug: string; accountId: string }> {
    const slug = await uniqueSchoolSlug(params.schoolName);
    const [org] = await db.insert(organizations).values({ name: params.schoolName, slug: `${slug}-org` }).returning();
    const [school] = await db.insert(schools).values({ orgId: org!.id, name: params.schoolName, slug }).returning();
    await this.ensureSystemRoles();

    const [firstName, ...rest] = params.adminName.trim().split(/\s+/);
    const principal = await runWithTenant({ schoolId: school!.id, orgId: org!.id }, () =>
      this.addPrincipal({
        email: params.adminEmail,
        password: params.adminPassword,
        firstName: firstName ?? params.adminName,
        lastName: rest.join(" ") || ".",
        role: "school-admin",
        emailVerified: params.emailVerified,
      }),
    );
    return { schoolId: school!.id, orgId: org!.id, slug, accountId: principal.accountId };
  },
};
