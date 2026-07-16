import { randomUUID } from "node:crypto";
import { HttpError } from "../../lib/http-error.js";
import { providerFor, type InitResult } from "../../payments/index.js";
import { schoolService } from "./school.service.js";

/**
 * Aeon's own subscription plans. Priced per term — schools budget termly,
 * so billing is an invoice-style charge each term, not a monthly mandate.
 */
export const PAID_PLANS = {
  growth: { amountMinor: 5_000_000, currency: "NGN" }, // ₦50,000/term in kobo
} as const;

export type PaidPlanId = keyof typeof PAID_PLANS;

export function isPaidPlan(plan: string): plan is PaidPlanId {
  return plan in PAID_PLANS;
}

export const billingService = {
  /** Starts a hosted checkout for one term of the given plan. */
  async startPlanCheckout(schoolId: string, plan: PaidPlanId): Promise<InitResult> {
    const price = PAID_PLANS[plan];
    const school = await schoolService.byId(schoolId);
    if (!school) throw new HttpError(404, "School not found");
    if (!school.email) {
      throw new HttpError(422, "Add a school contact email under School Profile before checking out");
    }
    return providerFor(price.currency).initiatePayment({
      amountMinor: price.amountMinor,
      currency: price.currency,
      reference: randomUUID(),
      idempotencyKey: randomUUID(),
      customer: { email: school.email },
      metadata: { purpose: "subscription", schoolId, plan },
    });
  },
};
