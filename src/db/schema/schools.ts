import { pgTable, uuid, text, timestamp, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { organizations } from "./organizations.js";

/**
 * School = the default tenant. Every tenant-owned row carries `school_id`
 * (and we denormalize `org_id` for org-level reporting). RLS policies key off
 * the current school set per request (ADR-2).
 */
export const schools = pgTable(
  "schools",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    email: text("email"),
    phone: text("phone"),
    address: text("address"),
    settings: jsonb("settings").notNull().default({}).$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    slugUq: uniqueIndex("schools_slug_uq").on(t.slug),
  }),
);
