import type {
  PaymentProvider,
  InitiateParams,
  InitResult,
  NormalizedPaymentEvent,
  RefundResult,
} from "./provider.js";

/**
 * A stub provider used in dev/tests — succeeds for any currency and echoes a
 * normalized event. Real providers (Paystack/Flutterwave) replace this with
 * signature verification and gateway calls behind the same interface.
 */
export class StubProvider implements PaymentProvider {
  readonly name = "stub";
  supports(): boolean {
    return true;
  }
  async initiatePayment(p: InitiateParams): Promise<InitResult> {
    return { providerRef: `stub_${p.reference}` };
  }
  parseEvent(raw: unknown): NormalizedPaymentEvent {
    const e = raw as Partial<NormalizedPaymentEvent>;
    return {
      idempotencyKey: String(e.idempotencyKey),
      providerRef: String(e.providerRef),
      amountMinor: Number(e.amountMinor),
      currency: String(e.currency),
      studentId: String(e.studentId),
      status: e.status === "failed" ? "failed" : "succeeded",
    };
  }
  async refund(p: { providerRef: string }): Promise<RefundResult> {
    return { providerRef: p.providerRef, status: "succeeded" };
  }
}
