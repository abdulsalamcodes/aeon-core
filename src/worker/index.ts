import { startRelay } from "../events/relay.js";
import { subscribe } from "../events/bus.js";
import { logger } from "../config/logger.js";

/**
 * Worker tier (ADR-6): runs the outbox relay and event consumers. Separate
 * process from the API so long/bursty work (PDFs, imports, notifications,
 * billing) never blocks request latency.
 */
function main() {
  // 1) Relay: outbox → bus.
  startRelay(1000);

  // 2) Example consumer: react to SubjectCreated. Real modules register their
  //    own idempotent handlers here. Demonstrates the "ripple" (ADR-5).
  void subscribe("core-workers", `worker-${process.pid}`, async (evt) => {
    if (evt.eventType === "SubjectCreated") {
      logger.info({ subjectId: evt.payload.id, schoolId: evt.schoolId }, "reacted to SubjectCreated");
      // e.g. seed timetable slots, notify HOD, etc.
    }
  });

  logger.info("schooler-core worker started");
}

main();
