import express, { Router } from "express";
import { z } from "zod";
import {
  providerByName,
  PaystackProvider,
  type PaystackChargeEvent,
} from "../../payments/index.js";
import { runWithTenant } from "../../tenant/context.js";
import { financeService } from "./finance.service.js";
import { schoolService } from "../org/school.service.js";
import { logger } from "../../config/logger.js";

const feeMetadata = z.object({
  purpose: z.literal("fee"),
  studentId: z.string().uuid(),
  termId: z.string().uuid(),
  schoolId: z.string().uuid(),
  orgId: z.string().uuid(),
});

const subscriptionMetadata = z.object({
  purpose: z.literal("subscription"),
  schoolId: z.string().uuid(),
  plan: z.string().min(1),
});

async function creditFeePayment(
  evt: PaystackChargeEvent,
  meta: z.infer<typeof feeMetadata>,
): Promise<void> {
  await runWithTenant({ schoolId: meta.schoolId, orgId: meta.orgId }, () =>
    financeService.recordPayment({
      studentId: meta.studentId,
      termId: meta.termId,
      amountMinor: evt.amountMinor,
      currency: evt.currency,
      idempotencyKey: `paystack:${evt.reference}`,
      method: "card",
      reference: evt.reference,
    }),
  );
}

async function activateSubscription(
  evt: PaystackChargeEvent,
  meta: z.infer<typeof subscriptionMetadata>,
): Promise<void> {
  await schoolService.updateSettings(meta.schoolId, {
    billing: {
      plan: meta.plan,
      status: "active",
      lastPaymentAt: new Date().toISOString(),
      lastPaymentRef: evt.reference,
    },
  });
}

/**
 * Public Paystack webhook — no bearer auth (Paystack can't log in); trust
 * comes from the HMAC signature over the raw body, which is why this router
 * mounts BEFORE express.json() and reads the body with express.raw().
 */
export const paystackWebhookRouter: Router = Router();

paystackWebhookRouter.post(
  "/webhook/paystack",
  express.raw({ type: "*/*" }),
  async (req, res, next) => {
    try {
      const provider = providerByName("paystack") as PaystackProvider;
      const evt = provider.verifyAndParseWebhook(
        req.body,
        req.headers["x-paystack-signature"] as string | undefined,
      );
      if (evt.status !== "succeeded") {
        res.json({ received: true, recorded: false });
        return;
      }

      const fee = feeMetadata.safeParse(evt.metadata);
      if (fee.success) {
        await creditFeePayment(evt, fee.data);
        res.json({ received: true, recorded: true });
        return;
      }

      const subscription = subscriptionMetadata.safeParse(evt.metadata);
      if (subscription.success) {
        await activateSubscription(evt, subscription.data);
        res.json({ received: true, recorded: true });
        return;
      }

      logger.warn(
        { reference: evt.reference },
        "paystack webhook: unrecognized metadata, ignoring",
      );
      res.json({ received: true, recorded: false });
    } catch (err) {
      next(err);
    }
  },
);
