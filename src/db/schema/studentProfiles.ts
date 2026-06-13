import { pgTable, uuid, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { schools } from "./schools.js";
import { persons } from "./persons.js";

/**
 * Student profile = student-specific facts that hang off a `person` (parallel
 * to staff_profiles). Keeps `person` generic while giving the UI the fields it
 * needs (admission number, gender, guardian contact). Tenant-owned.
 */
export const studentProfiles = pgTable(
  "student_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
    personId: uuid("person_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
    studentNumber: text("student_number"),
    gender: text("gender", { enum: ["male", "female"] }),
    guardianName: text("guardian_name"),
    guardianPhone: text("guardian_phone"),
    guardianEmail: text("guardian_email"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    personUq: uniqueIndex("student_profiles_person_uq").on(t.personId),
    numberUq: uniqueIndex("student_profiles_number_uq").on(t.schoolId, t.studentNumber),
  }),
);

export type StudentProfile = typeof studentProfiles.$inferSelect;
export type NewStudentProfile = typeof studentProfiles.$inferInsert;
