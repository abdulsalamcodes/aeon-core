import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";

/**
 * Transactional outbox (ADR-5). Domain writes and the corresponding event row
 * commit in the SAME transaction, so an event can never be lost or duplicated
 * relative to the state change. A relay polls unpublished rows and forwards
 * them to the bus.
 */
export const outboxEvents = pgTable(
  "outbox_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    schoolId: uuid("school_id").notNull(),
    aggregate: text("aggregate").notNull(), // e.g. "subject"
    aggregateId: uuid("aggregate_id").notNull(),
    eventType: text("event_type").notNull(), // e.g. "SubjectCreated"
    payload: jsonb("payload").notNull().$type<Record<string, unknown>>(),
    actorId: uuid("actor_id"),
    actorName: text("actor_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (t) => ({
    unpublishedIdx: index("outbox_unpublished_idx").on(t.publishedAt, t.createdAt),
  }),
);

export type OutboxEvent = typeof outboxEvents.$inferSelect;
export type NewOutboxEvent = typeof outboxEvents.$inferInsert;
