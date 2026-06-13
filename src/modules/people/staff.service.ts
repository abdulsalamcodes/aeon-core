import { eq, ne, and } from "drizzle-orm";
import { persons, memberships, accounts } from "../../db/schema/index.js";
import { withTenant } from "../../tenant/context.js";

export interface StaffRow {
  id: string;
  name: string;
  email: string;
  role: string;
}

export const staffService = {
  /** Staff = persons with a non-student membership in this school. */
  async list(): Promise<StaffRow[]> {
    const rows = await withTenant((tx) =>
      tx
        .select({
          id: persons.id,
          firstName: persons.firstName,
          lastName: persons.lastName,
          email: accounts.email,
          role: memberships.roleName,
        })
        .from(memberships)
        .innerJoin(persons, eq(persons.id, memberships.personId))
        .innerJoin(accounts, eq(accounts.id, memberships.accountId))
        .where(and(ne(memberships.roleName, "student"), eq(memberships.status, "active"))),
    );
    return rows.map((r) => ({ id: r.id, name: `${r.firstName} ${r.lastName}`, email: r.email, role: r.role }));
  },
};
