import { pgTable, uuid, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { schools } from "./schools.js";
import { organizations } from "./organizations.js";
import { persons } from "./persons.js";

/**
 * Class (a.k.a. arm/grade) — tenant-owned. `classTeacher` is an optional person
 * (a staff member). Subjects offered are linked via the subjects module later.
 */
export const classes = pgTable(
  "classes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    classTeacherId: uuid("class_teacher_id").references(() => persons.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    nameUq: uniqueIndex("classes_school_name_uq").on(t.schoolId, t.name),
  }),
);

export type Class = typeof classes.$inferSelect;
export type NewClass = typeof classes.$inferInsert;
