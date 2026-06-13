import { pgTable, uuid, text, timestamp, date, uniqueIndex } from "drizzle-orm/pg-core";
import { schools } from "./schools.js";
import { persons } from "./persons.js";
import { classes } from "./classes.js";
import { terms } from "./terms.js";

/**
 * Attendance — one row per student per day per class (tenant-owned). Register
 * entries are seeded by the `StudentEnrolled` ripple and marked by teachers.
 */
export const attendance = pgTable(
  "attendance",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
    studentId: uuid("student_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
    classId: uuid("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
    termId: uuid("term_id").notNull().references(() => terms.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    status: text("status", { enum: ["present", "absent", "late", "excused", "unmarked"] })
      .notNull()
      .default("unmarked"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    dayUq: uniqueIndex("attendance_student_class_date_uq").on(t.studentId, t.classId, t.date),
  }),
);

export type Attendance = typeof attendance.$inferSelect;
export type NewAttendance = typeof attendance.$inferInsert;
