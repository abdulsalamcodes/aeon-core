import { pgTable, uuid, text, timestamp, date, index } from "drizzle-orm/pg-core";
import { schools } from "./schools.js";

/** Academic calendar events (holidays, exams, term markers). Tenant-owned. */
export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    type: text("type", { enum: ["holiday", "exam", "event", "term-start", "term-end"] }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ schoolStartIdx: index("calendar_school_start_idx").on(t.schoolId, t.startDate) }),
);

export type CalendarEvent = typeof calendarEvents.$inferSelect;
