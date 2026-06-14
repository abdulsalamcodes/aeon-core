import { pgTable, uuid, jsonb, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { schools } from "./schools.js";
import { classes } from "./classes.js";
import { terms } from "./terms.js";

export interface TimetablePeriod {
  subjectId: string;
  subjectName?: string;
  teacherId?: string;
  teacherName?: string;
  startTime: string;
  endTime: string;
}
export interface TimetableDay {
  day: string;
  periods: TimetablePeriod[];
}

/** One timetable per class per term (the weekly schedule, stored as JSONB). */
export const timetables = pgTable(
  "timetables",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
    classId: uuid("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
    termId: uuid("term_id").notNull().references(() => terms.id, { onDelete: "cascade" }),
    schedule: jsonb("schedule").notNull().$type<TimetableDay[]>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ classTermUq: uniqueIndex("timetables_class_term_uq").on(t.classId, t.termId) }),
);

export type Timetable = typeof timetables.$inferSelect;
