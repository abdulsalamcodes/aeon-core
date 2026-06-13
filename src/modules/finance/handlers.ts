import { runWithTenant } from "../../tenant/context.js";
import { financeService } from "./finance.service.js";
import { logger } from "../../config/logger.js";

/**
 * Finance's reaction to `StudentEnrolled` (ADR-5 ripple): if the term has a
 * default fee structure, bill the newly enrolled student. Idempotency for the
 * fee debit would key on (student, term, structure) in a fuller impl; here the
 * demo assigns once. Runs in the worker, rebuilding tenant context from the
 * event payload.
 */
export async function onStudentEnrolled(payload: Record<string, unknown>): Promise<void> {
  const schoolId = String(payload.schoolId);
  const orgId = String(payload.orgId);
  const studentId = String(payload.studentId);
  const termId = String(payload.termId);

  await runWithTenant({ schoolId, orgId }, async () => {
    const fee = await financeService.defaultFeeForTerm(termId);
    if (!fee) return;
    await financeService.assignFee({ studentId, feeStructureId: fee.id });
    logger.info({ studentId, termId, amountMinor: fee.amountMinor, currency: fee.currency }, "finance: billed default term fee on StudentEnrolled");
  });
}
