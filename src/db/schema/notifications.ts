import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { schools } from "./schools.js";

/**
 * Notification log (ADR-11). Tenant-owned record of every message dispatched.
 * SMS-first for African guardians; channel is pluggable (sms/whatsapp/email).
 * Status tracks delivery lifecycle.
 */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
    channel: text("channel", { enum: ["sms", "whatsapp", "email"] }).notNull(),
    toAddress: text("to_address").notNull(),
    template: text("template").notNull(),
    body: text("body").notNull(),
    status: text("status", { enum: ["queued", "sent", "failed"] }).notNull().default("queued"),
    meta: jsonb("meta").notNull().default({}).$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    schoolIdx: index("notifications_school_idx").on(t.schoolId, t.createdAt),
  }),
);

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
