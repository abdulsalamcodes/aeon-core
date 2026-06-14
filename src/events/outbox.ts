import { outboxEvents } from "../db/schema/outbox.js";
import { currentActor, type Tx } from "../tenant/context.js";

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
  const actor = currentActor();
  await tx.insert(outboxEvents).values({
    schoolId,
    aggregate: event.aggregate,
    aggregateId: event.aggregateId,
    eventType: event.eventType,
    payload: event.payload,
    actorId: actor.actorId ?? null,
    actorName: actor.actorName ?? null,
  });
}
