import { outboxEvents } from "../db/schema/outbox.js";
import type { Tx } from "../tenant/context.js";

export interface DomainEventInput {
  aggregate: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
}

/**
 * Append a domain event to the outbox **inside the caller's transaction** so it
 * commits atomically with the state change (ADR-5). Never publish to the bus
 * directly from request code — the relay does that.
 */
export async function emit(tx: Tx, schoolId: string, event: DomainEventInput): Promise<void> {
  await tx.insert(outboxEvents).values({
    schoolId,
    aggregate: event.aggregate,
    aggregateId: event.aggregateId,
    eventType: event.eventType,
    payload: event.payload,
  });
}
