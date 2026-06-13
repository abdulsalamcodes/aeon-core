import { eq, and, isNull } from "drizzle-orm";
import { db } from "../../db/client.js";
import { roles, persons, memberships } from "../../db/schema/index.js";
import { currentTenant, withTenant } from "../../tenant/context.js";
import { authService } from "./auth.service.js";

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
  }): Promise<{ accountId: string; personId: string; membershipId: string }> {
    const { schoolId, orgId } = currentTenant();

    // 1) Global login identity (outside tenant).
    const account = await authService.createAccount(params.email, params.password);

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
};
