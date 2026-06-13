import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { schools } from "./schools.js";
import { organizations } from "./organizations.js";
import { persons } from "./persons.js";
import { accounts } from "./accounts.js";
import { roles } from "./roles.js";

/**
 * Membership = the join that says "this person is a <role> at <school> with
 * <scope>" (ADR-4). One account can hold many memberships (teacher here, parent
 * there). `accountId` and `roleName` are denormalized so the login path can
 * resolve a principal's memberships in a single query under the
 * `app.current_account` RLS escape — before any tenant is chosen.
 *
 * `scope` narrows what the role may touch (e.g. specific classes/subjects);
 * empty/`{}` means school-wide for that role.
 */
export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
    personId: uuid("person_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
    roleId: uuid("role_id").notNull().references(() => roles.id, { onDelete: "restrict" }),
    roleName: text("role_name").notNull(),
    status: text("status", { enum: ["active", "suspended"] }).notNull().default("active"),
    scope: jsonb("scope").notNull().default({}).$type<Record<string, unknown>>(),
    /** True for org-level principals (e.g. a director) who span the whole org. */
    orgWide: text("org_wide", { enum: ["on", "off"] }).notNull().default("off"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    accountIdx: index("memberships_account_idx").on(t.accountId),
    schoolIdx: index("memberships_school_idx").on(t.schoolId),
  }),
);

export type Membership = typeof memberships.$inferSelect;
export type NewMembership = typeof memberships.$inferInsert;
