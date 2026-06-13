import { pgTable, uuid, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * Organization = the top of the tenancy hierarchy (a group / district / chain).
 * Every independent school still belongs to exactly one organization, so groups
 * slot in later with no rewrite (ADR-2).
 */
export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    slugUq: uniqueIndex("organizations_slug_uq").on(t.slug),
  }),
);
