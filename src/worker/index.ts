import { startRelay } from "../events/relay.js";
import { subscribe } from "../events/bus.js";
import { logger } from "../config/logger.js";
import { STUDENT_ENROLLED } from "../modules/people/index.js";
import { onStudentEnrolled } from "../modules/academics/index.js";

/**
 * Worker tier (ADR-6): runs the outbox relay and event consumers. Separate
 * process from the API so long/bursty work (PDFs, imports, notifications,
 * billing) never blocks request latency.
 */
function main() {
  // 1) Relay: outbox → bus.
  startRelay(1000);

  // 2) Consumers. Each module registers its own idempotent reactions; the
  //    bus redelivers until acked (ADR-5). The headline ripple: enrolling a
  //    student seeds the attendance register in Academics.
  void subscribe("core-workers", `worker-${process.pid}`, async (evt) => {
    switch (evt.eventType) {
      case STUDENT_ENROLLED:
        await onStudentEnrolled(evt.payload);
        break;
      case "SubjectCreated":
        logger.info({ subjectId: evt.payload.id, schoolId: evt.schoolId }, "reacted to SubjectCreated");
        break;
      default:
        break;
    }
  });

  logger.info("schooler-core worker started");
}

main();
