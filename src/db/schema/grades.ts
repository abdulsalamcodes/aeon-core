import { pgTable, uuid, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { schools } from "./schools.js";
import { persons } from "./persons.js";
import { subjects } from "./subjects.js";
import { terms } from "./terms.js";

/**
 * Grade — a student's score in a subject for a term (tenant-owned). CA + exam
 * are stored as integer points; the total/letter are computed by the grading
 * config (config-as-data, ADR-9) rather than hard-coded here.
 */
export const grades = pgTable(
  "grades",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
    studentId: uuid("student_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
    subjectId: uuid("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
    termId: uuid("term_id").notNull().references(() => terms.id, { onDelete: "cascade" }),
    caScore: integer("ca_score").notNull().default(0),
    examScore: integer("exam_score").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniq: uniqueIndex("grades_student_subject_term_uq").on(t.studentId, t.subjectId, t.termId),
  }),
);

export type Grade = typeof grades.$inferSelect;
export type NewGrade = typeof grades.$inferInsert;
