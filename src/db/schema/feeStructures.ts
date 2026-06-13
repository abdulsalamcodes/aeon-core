import { pgTable, uuid, text, bigint, timestamp, boolean } from "drizzle-orm/pg-core";
import { schools } from "./schools.js";
import { organizations } from "./organizations.js";
import { terms } from "./terms.js";

/**
 * Fee structure = a billable amount for a term (tenant-owned). Money is ALWAYS
 * `(amountMinor: bigint, currency: ISO-4217)` — integer minor units, never
 * floats, currency on every amount (ADR-8). `isDefault` marks the structure
 * auto-assigned to newly enrolled students of the term.
 */
export const feeStructures = pgTable("fee_structures", {
  id: uuid("id").defaultRandom().primaryKey(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  termId: uuid("term_id").notNull().references(() => terms.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
  currency: text("currency").notNull(), // ISO-4217, e.g. NGN, GHS, KES, USD
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type FeeStructure = typeof feeStructures.$inferSelect;
export type NewFeeStructure = typeof feeStructures.$inferInsert;
