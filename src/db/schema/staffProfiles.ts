import { pgTable, uuid, text, timestamp, date, uniqueIndex } from "drizzle-orm/pg-core";
import { schools } from "./schools.js";
import { persons } from "./persons.js";

/**
 * Staff profile = the HR/employment record that hangs off a `person` (ADR-4,
 * the "one worker record" parallel). Tenant-owned. Separate from membership:
 * membership grants access, this captures employment facts.
 */
export const staffProfiles = pgTable(
  "staff_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
    personId: uuid("person_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
    employeeNo: text("employee_no"),
    department: text("department"),
    title: text("title"),
    hiredAt: date("hired_at"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    personUq: uniqueIndex("staff_profiles_person_uq").on(t.personId),
  }),
);

export type StaffProfile = typeof staffProfiles.$inferSelect;
export type NewStaffProfile = typeof staffProfiles.$inferInsert;
