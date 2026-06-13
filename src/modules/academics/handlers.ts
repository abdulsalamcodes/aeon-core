import { runWithTenant } from "../../tenant/context.js";
import { attendanceService } from "./attendance.service.js";
import { logger } from "../../config/logger.js";

/**
 * Academics' reaction to `StudentEnrolled` (ADR-5 ripple). Runs in the worker,
 * OUTSIDE any request — so it rebuilds the tenant context from the event's
 * schoolId/orgId before touching tenant data. Idempotent (seedRegister uses
 * ON CONFLICT DO NOTHING), safe for at-least-once redelivery.
 */
export async function onStudentEnrolled(payload: Record<string, unknown>): Promise<void> {
  const schoolId = String(payload.schoolId);
  const orgId = String(payload.orgId);
  const studentId = String(payload.studentId);
  const classId = String(payload.classId);
  const termId = String(payload.termId);
  const date = new Date().toISOString().slice(0, 10);

  await runWithTenant({ schoolId, orgId }, () =>
    attendanceService.seedRegister({ studentId, classId, termId, date }),
  );
  logger.info({ studentId, classId }, "academics: seeded attendance register on StudentEnrolled");
}
