import { pgTable, uuid, text, timestamp, date } from "drizzle-orm/pg-core";
import { schools } from "./schools.js";
import { organizations } from "./organizations.js";
import { accounts } from "./accounts.js";

/**
 * Person = the human + PII (ADR-4). Tenant-owned (school_id). A student, a
 * staff member, and a guardian are all `persons`; what differs is their
 * memberships and profiles. `accountId` links to the login identity (null for
 * people who don't sign in, e.g. a young pupil).
 */
export const persons = pgTable("persons", {
  id: uuid("id").defaultRandom().primaryKey(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  dob: date("dob"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export type Person = typeof persons.$inferSelect;
export type NewPerson = typeof persons.$inferInsert;
