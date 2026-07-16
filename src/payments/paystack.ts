import { createHmac, timingSafeEqual } from "node:crypto";
import { HttpError } from "../lib/http-error.js";
import type {
  PaymentProvider,
  InitiateParams,
  InitResult,
  NormalizedPaymentEvent,
  RefundResult,
} from "./provider.js";

const SUPPORTED_CURRENCIES = ["NGN"];
const SIGNATURE_HEADER_ALGORITHM = "sha512";

/** What Paystack posts to our webhook (the fields we consume). */
interface PaystackWebhookPayload {
  event: string;
  data: {
    reference: string;
    amount: number;
    currency: string;
    status: string;
    metadata?: Record<string, unknown>;
  };
}

/** A verified charge event with the metadata we attached at initiation. */
export interface PaystackChargeEvent {
  event: string;
  reference: string;
  amountMinor: number;
  currency: string;
  status: "succeeded" | "failed";
  metadata: Record<string, unknown>;
}

/**
 * Paystack gateway (ADR-11). Hosted checkout via /transaction/initialize;
 * webhooks verified with HMAC-SHA512 over the raw body. Fee/subscription
 * context travels in `metadata` so the webhook can route the money without
 * any server-side session state.
 */
export class PaystackProvider implements PaymentProvider {
  readonly name = "paystack";

  constructor(
    private readonly secretKey: string,
    private readonly baseUrl: string,
  ) {}

  supports(currency: string): boolean {
    return SUPPORTED_CURRENCIES.includes(currency.toUpperCase());
  }

  async initiatePayment(p: InitiateParams): Promise<InitResult> {
    if (!p.customer.email) {
      throw new HttpError(422, "Paystack requires a customer email to start a payment");
    }
    const data = await this.post<{ authorization_url: string; reference: string }>(
      "/transaction/initialize",
      {
        email: p.customer.email,
        amount: p.amountMinor,
        currency: p.currency,
        reference: p.reference,
        metadata: p.metadata ?? {},
      },
    );
    return { providerRef: data.reference, redirectUrl: data.authorization_url };
  }

  /**
   * Verifies the webhook signature and normalizes the payload. Throws 401 on
   * a bad signature — never process an unverified event.
   */
  verifyAndParseWebhook(rawBody: string | Buffer, signature: string | undefined): PaystackChargeEvent {
    if (!this.signatureMatches(rawBody, signature)) {
      throw new HttpError(401, "Invalid Paystack webhook signature");
    }
    const payload = JSON.parse(rawBody.toString()) as PaystackWebhookPayload;
    return {
      event: payload.event,
      reference: payload.data.reference,
      amountMinor: payload.data.amount,
      currency: payload.data.currency,
      status: payload.event === "charge.success" && payload.data.status === "success" ? "succeeded" : "failed",
      metadata: payload.data.metadata ?? {},
    };
  }

  parseEvent(raw: unknown): NormalizedPaymentEvent {
    const { rawBody, signature } = raw as { rawBody: string | Buffer; signature?: string };
    const evt = this.verifyAndParseWebhook(rawBody, signature);
    return {
      idempotencyKey: `paystack:${evt.reference}`,
      providerRef: evt.reference,
      amountMinor: evt.amountMinor,
      currency: evt.currency,
      studentId: String(evt.metadata.studentId ?? ""),
      status: evt.status,
    };
  }

  async refund(p: { providerRef: string; amountMinor: number; idempotencyKey: string }): Promise<RefundResult> {
    const data = await this.post<{ status: string }>("/refund", {
      transaction: p.providerRef,
      amount: p.amountMinor,
    });
    return { providerRef: p.providerRef, status: data.status === "failed" ? "failed" : "succeeded" };
  }

  private signatureMatches(rawBody: string | Buffer, signature: string | undefined): boolean {
    if (!signature) return false;
    const expected = createHmac(SIGNATURE_HEADER_ALGORITHM, this.secretKey).update(rawBody).digest("hex");
    const expectedBuffer = Buffer.from(expected);
    const receivedBuffer = Buffer.from(signature);
    return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
  }

  private async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const parsed = (await res.json().catch(() => ({}))) as { status?: boolean; message?: string; data?: T };
    if (!res.ok || parsed.status === false || parsed.data === undefined) {
      throw new HttpError(502, `Paystack ${path} failed: ${parsed.message ?? res.statusText}`);
    }
    return parsed.data;
  }
}
