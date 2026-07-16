/**
 * PaymentProvider abstraction (ADR-11). The finance core talks to THIS — it
 * never knows which gateway is live. Paystack and Flutterwave are the first
 * implementations; Stripe and others slot in later by adding a class, with no
 * change to finance/ledger code. A school picks a provider per currency.
 */
export interface PayerRef {
  /** Absent for non-student payments (e.g. a school's subscription). */
  studentId?: string;
  email?: string;
}

export interface InitResult {
  providerRef: string;
  /** Hosted checkout URL, when the provider uses redirect flows. */
  redirectUrl?: string;
}

export interface NormalizedPaymentEvent {
  /** Idempotency key — replays of the same event must net one ledger entry. */
  idempotencyKey: string;
  providerRef: string;
  amountMinor: number;
  currency: string;
  studentId: string;
  status: "succeeded" | "failed";
}

export interface RefundResult {
  providerRef: string;
  status: "succeeded" | "failed";
}

export interface InitiateParams {
  amountMinor: number;
  currency: string;
  reference: string;
  idempotencyKey: string;
  customer: PayerRef;
  metadata?: Record<string, unknown>;
}

export interface PaymentProvider {
  readonly name: string;
  supports(currency: string): boolean;
  initiatePayment(p: InitiateParams): Promise<InitResult>;
  /** Verify signature + parse a webhook into one canonical event the ledger consumes. */
  parseEvent(raw: unknown): NormalizedPaymentEvent;
  refund(p: { providerRef: string; amountMinor: number; idempotencyKey: string }): Promise<RefundResult>;
}

/**
 * Currency-routed registry. Providers register the currencies they support;
 * the finance core asks for "a provider for NGN" and gets one (e.g. Paystack),
 * or for "USD" and gets another (e.g. Stripe) — same interface throughout.
 */
const registry: PaymentProvider[] = [];

export function registerProvider(p: PaymentProvider): void {
  registry.push(p);
}

export function providerFor(currency: string): PaymentProvider {
  const p = registry.find((x) => x.supports(currency));
  if (!p) throw new Error(`No payment provider configured for ${currency}`);
  return p;
}

export function providerByName(name: string): PaymentProvider {
  const p = registry.find((x) => x.name === name);
  if (!p) throw new Error(`Unknown payment provider '${name}'`);
  return p;
}
