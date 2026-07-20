import { eq, ne, and } from "drizzle-orm";
import { persons, memberships, accounts } from "../../db/schema/index.js";
import { withTenant } from "../../tenant/context.js";
import { provisionService, type SystemRole } from "../identity/index.js";
import type { CreateStaffInput } from "./people.schema.js";

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

  async create(input: CreateStaffInput): Promise<StaffRow> {
    const [firstName, ...rest] = input.name.trim().split(" ");
    const role = (["school-admin", "teacher"].includes(input.role) ? input.role : "teacher") as SystemRole;
    const { personId } = await provisionService.addPrincipal({
      email: input.email,
      password: input.password,
      firstName: firstName ?? input.name,
      lastName: rest.join(" ") || ".",
      role,
    });
    return { id: personId, name: input.name, email: input.email, role };
  },

  async remove(personId: string): Promise<void> {
    await withTenant((tx) => tx.update(memberships).set({ status: "suspended" }).where(eq(memberships.personId, personId)));
  },
};
