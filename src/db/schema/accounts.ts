import { pgTable, uuid, text, timestamp, boolean, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * Account = one per human LOGIN (ADR-4). Global, not tenant-owned: a single
 * person may hold memberships at several schools but authenticates once.
 * Auth concerns only — PII lives on `persons`.
 */
export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    phone: text("phone"),
    passwordHash: text("password_hash").notNull(),
    status: text("status", { enum: ["active", "disabled"] }).notNull().default("active"),
    /** Platform super-admin (manages institutions across all tenants). */
    isSuperAdmin: boolean("is_super_admin").notNull().default(false),
    resetTokenHash: text("reset_token_hash"),
    resetExpires: timestamp("reset_expires", { withTimezone: true }),
    emailVerified: boolean("email_verified").notNull().default(false),
    verifyTokenHash: text("verify_token_hash"),
    verifyExpires: timestamp("verify_expires", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    emailUq: uniqueIndex("accounts_email_uq").on(t.email),
  }),
);

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
