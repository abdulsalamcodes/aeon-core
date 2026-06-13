import { runWithTenant } from "../../tenant/context.js";
import { notificationService } from "./notification.service.js";

/**
 * Notifications react to domain events (ADR-5/11). This is the third leg of the
 * enrolment ripple: enrolling a student notifies the guardian. In a fuller impl
 * the guardian's phone is resolved from the People graph; the demo sends to the
 * address carried on the event (or a placeholder) via the SMS channel.
 */
export async function onStudentEnrolled(payload: Record<string, unknown>): Promise<void> {
  const schoolId = String(payload.schoolId);
  const orgId = String(payload.orgId);
  const to = String(payload.guardianPhone ?? "+000000000000");
  await runWithTenant({ schoolId, orgId }, () =>
    notificationService.send({
      channel: "sms",
      to,
      template: "guardian-invite",
      body: "A student linked to you was enrolled. Sign in to Aeon to follow their progress.",
    }),
  );
}

export async function onPaymentRecorded(payload: Record<string, unknown>): Promise<void> {
  const schoolId = String(payload.schoolId);
  const orgId = String(payload.orgId ?? "");
  const amountMinor = Number(payload.amountMinor ?? 0);
  const currency = String(payload.currency ?? "");
  const to = String(payload.guardianPhone ?? "+000000000000");
  await runWithTenant({ schoolId, orgId }, () =>
    notificationService.send({
      channel: "sms",
      to,
      template: "payment-receipt",
      body: `Payment received: ${(amountMinor / 100).toFixed(2)} ${currency}. Thank you.`,
    }),
  );
}
