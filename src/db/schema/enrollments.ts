import { pgTable, uuid, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { schools } from "./schools.js";
import { organizations } from "./organizations.js";
import { persons } from "./persons.js";
import { classes } from "./classes.js";
import { terms } from "./terms.js";

/**
 * Enrollment = the first-class edge (student × class × term) that anchors the
 * roster, *generates* attendance, and anchors grades (ADR-4 canonical graph).
 * A student is a `person` with one active enrollment per term.
 */
export const enrollments = pgTable(
  "enrollments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    studentId: uuid("student_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
    classId: uuid("class_id").notNull().references(() => classes.id, { onDelete: "restrict" }),
    termId: uuid("term_id").notNull().references(() => terms.id, { onDelete: "restrict" }),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true }).defaultNow().notNull(),
    unenrolledAt: timestamp("unenrolled_at", { withTimezone: true }),
  },
  (t) => ({
    studentTermUq: uniqueIndex("enrollments_student_term_uq").on(t.studentId, t.termId),
  }),
);

export type Enrollment = typeof enrollments.$inferSelect;
export type NewEnrollment = typeof enrollments.$inferInsert;
