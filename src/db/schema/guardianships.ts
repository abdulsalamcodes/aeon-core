import { pgTable, uuid, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { schools } from "./schools.js";
import { persons } from "./persons.js";

/**
 * Guardianship = the guardian↔student relationship (ADR-4). Both sides are
 * `persons`. One guardian can have many wards; a student can have several
 * guardians. Tenant-owned.
 */
export const guardianships = pgTable(
  "guardianships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
    guardianId: uuid("guardian_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
    studentId: uuid("student_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
    relationship: text("relationship"), // e.g. "mother", "uncle"
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pairUq: uniqueIndex("guardianships_pair_uq").on(t.guardianId, t.studentId),
  }),
);

export type Guardianship = typeof guardianships.$inferSelect;
export type NewGuardianship = typeof guardianships.$inferInsert;
