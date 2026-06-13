import { isNull, asc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { outboxEvents } from "../db/schema/outbox.js";
import { publish } from "./bus.js";
import { logger } from "../config/logger.js";

/**
 * Outbox relay (ADR-5). Polls unpublished events in commit order, forwards them
 * to the bus, and marks them published. Runs in the worker tier, not the API.
 *
 * Polling is the simplest correct v1; swap for Postgres LISTEN/NOTIFY to cut
 * latency without changing the contract.
 */
export async function runRelayOnce(batchSize = 100): Promise<number> {
  const pending = await db
    .select()
    .from(outboxEvents)
    .where(isNull(outboxEvents.publishedAt))
    .orderBy(asc(outboxEvents.createdAt))
    .limit(batchSize);

  for (const evt of pending) {
    await publish(evt);
    await db.update(outboxEvents).set({ publishedAt: new Date() }).where(eq(outboxEvents.id, evt.id));
  }
  return pending.length;
}

export function startRelay(intervalMs = 1000): NodeJS.Timeout {
  logger.info({ intervalMs }, "outbox relay started");
  let running = false;
  return setInterval(async () => {
    if (running) return; // never overlap ticks
    running = true;
    try {
      const n = await runRelayOnce();
      if (n > 0) logger.debug({ published: n }, "relay flushed outbox");
    } catch (err) {
      logger.error({ err }, "relay tick failed");
    } finally {
      running = false;
    }
  }, intervalMs);
}
