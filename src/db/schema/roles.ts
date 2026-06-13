import { pgTable, uuid, text, timestamp, jsonb, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { schools } from "./schools.js";

/**
 * Role = a named bundle of permissions (ADR-4). System roles (super-admin,
 * school-admin, teacher, student, guardian) have `schoolId = null` and
 * `isSystem = true`; schools may define their own roles too. Names are unique
 * per school (and once globally for system roles).
 */
export const roles = pgTable(
  "roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    permissions: jsonb("permissions").notNull().default([]).$type<string[]>(),
    isSystem: boolean("is_system").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    nameSchoolUq: uniqueIndex("roles_name_school_uq").on(t.name, t.schoolId),
  }),
);

export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;
