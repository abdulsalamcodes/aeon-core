import { pgTable, uuid, text, timestamp, date, boolean } from "drizzle-orm/pg-core";
import { schools } from "./schools.js";
import { organizations } from "./organizations.js";

/**
 * Term = an academic period within a school year (tenant-owned). Kept standalone
 * in Phase 2; an `academic_sessions` parent slots in later without changing the
 * grain. `isCurrent` marks the active term.
 */
export const terms = pgTable("terms", {
  id: uuid("id").defaultRandom().primaryKey(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  startDate: date("start_date"),
  endDate: date("end_date"),
  isCurrent: boolean("is_current").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Term = typeof terms.$inferSelect;
export type NewTerm = typeof terms.$inferInsert;
