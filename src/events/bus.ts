import { Redis } from "ioredis";
import { env } from "../config/env.js";
import type { OutboxEvent } from "../db/schema/outbox.js";

/**
 * The event bus. v1 is a Redis Stream — durable, ordered, and consumer-group
 * friendly — and upgrades to Kafka/NATS later without touching producers or
 * consumers (ADR-5). One stream key; consumers filter by `eventType`.
 */
const STREAM = "aeon:events";

let _redis: Redis | null = null;
function redis(): Redis {
  if (!_redis) _redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  return _redis;
}

export async function publish(evt: OutboxEvent): Promise<void> {
  await redis().xadd(
    STREAM,
    "*",
    "id", evt.id,
    "schoolId", evt.schoolId,
    "aggregate", evt.aggregate,
    "eventType", evt.eventType,
    "payload", JSON.stringify(evt.payload),
  );
}

export type EventHandler = (evt: {
  id: string;
  schoolId: string;
  aggregate: string;
  eventType: string;
  payload: Record<string, unknown>;
}) => Promise<void>;

/**
 * Minimal consumer-group reader. Consumers MUST be idempotent: the at-least-once
 * stream may redeliver (ADR-5).
 */
export async function subscribe(group: string, consumer: string, handler: EventHandler): Promise<void> {
  const r = redis();
  await r.xgroup("CREATE", STREAM, group, "$", "MKSTREAM").catch(() => {
    /* group already exists */
  });

  for (;;) {
    const res = (await r.xreadgroup(
      "GROUP", group, consumer, "COUNT", 20, "BLOCK", 5000, "STREAMS", STREAM, ">",
    )) as [string, [string, string[]][]][] | null;
    if (!res) continue;

    for (const [, entries] of res) {
      for (const [entryId, fields] of entries) {
        const map = Object.fromEntries(
          fields.reduce<[string, string][]>((acc, _v, i, arr) => {
            if (i % 2 === 0) acc.push([arr[i]!, arr[i + 1]!]);
            return acc;
          }, []),
        );
        try {
          await handler({
            id: map.id!,
            schoolId: map.schoolId!,
            aggregate: map.aggregate!,
            eventType: map.eventType!,
            payload: JSON.parse(map.payload ?? "{}"),
          });
          await r.xack(STREAM, group, entryId);
        } catch (err) {
          // Leave unacked for redelivery; a real impl moves to a dead-letter after N tries.
          console.error(`handler failed for ${entryId}`, err);
        }
      }
    }
  }
}
