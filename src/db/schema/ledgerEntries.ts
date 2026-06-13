import { pgTable, uuid, text, bigint, timestamp, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { schools } from "./schools.js";
import { persons } from "./persons.js";
import { terms } from "./terms.js";

/**
 * Append-only ledger (ADR-8). Balances are DERIVED from immutable entries —
 * never a mutable field. A fee is a `debit`, a payment a `credit`, a refund a
 * new `credit`/`debit` reversal; nothing is ever updated or deleted.
 *
 * - Money is `(amountMinor: bigint, currency)`, integer minor units, no floats.
 * - You may only net entries of the SAME currency; cross-currency requires an
 *   explicit FX entry (out of Phase 3 scope but the shape supports it).
 * - `idempotencyKey` is unique per school: replaying a payment webhook writes
 *   at most one entry, so at-least-once gateways can't double-credit.
 */
export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
    studentId: uuid("student_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
    termId: uuid("term_id").notNull().references(() => terms.id, { onDelete: "cascade" }),
    direction: text("direction", { enum: ["debit", "credit"] }).notNull(),
    kind: text("kind", { enum: ["fee", "payment", "adjustment", "refund"] }).notNull(),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    currency: text("currency").notNull(),
    reference: text("reference"),
    idempotencyKey: text("idempotency_key"),
    meta: jsonb("meta").notNull().default({}).$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    idemUq: uniqueIndex("ledger_idempotency_uq").on(t.schoolId, t.idempotencyKey),
    studentTermIdx: index("ledger_student_term_idx").on(t.studentId, t.termId),
  }),
);

export type LedgerEntry = typeof ledgerEntries.$inferSelect;
export type NewLedgerEntry = typeof ledgerEntries.$inferInsert;
