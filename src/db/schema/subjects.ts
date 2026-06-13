import { pgTable, uuid, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { schools } from "./schools.js";
import { organizations } from "./organizations.js";

/**
 * Subjects — the trivial, tenant-scoped module used to prove the whole stack
 * end-to-end in Phase 0 (schema → RLS → service → routes → events).
 *
 * `schoolId` is the tenant key enforced by RLS; `orgId` is denormalized so
 * org-level roles can read across a group without a join.
 */
export const subjects = pgTable(
  "subjects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    schoolNameUq: uniqueIndex("subjects_school_name_uq").on(t.schoolId, t.name),
  }),
);

export type Subject = typeof subjects.$inferSelect;
export type NewSubject = typeof subjects.$inferInsert;
