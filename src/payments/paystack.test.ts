import { describe, it, expect, vi, afterEach } from "vitest";
import { createHmac } from "node:crypto";
import { PaystackProvider } from "./paystack.js";
import { HttpError } from "../lib/http-error.js";

const SECRET = "sk_test_secret";
const provider = new PaystackProvider(SECRET, "https://paystack.test");

function signedBody(payload: object): { rawBody: string; signature: string } {
  const rawBody = JSON.stringify(payload);
  const signature = createHmac("sha512", SECRET).update(rawBody).digest("hex");
  return { rawBody, signature };
}

const chargeSuccess = {
  event: "charge.success",
  data: {
    reference: "ref-123",
    amount: 500_000,
    currency: "NGN",
    status: "success",
    metadata: { purpose: "fee", studentId: "11111111-1111-1111-1111-111111111111" },
  },
};

afterEach(() => vi.restoreAllMocks());

describe("PaystackProvider webhook verification", () => {
  it("accepts a correctly signed payload and normalizes it", () => {
    const { rawBody, signature } = signedBody(chargeSuccess);
    const evt = provider.verifyAndParseWebhook(rawBody, signature);
    expect(evt).toMatchObject({
      reference: "ref-123",
      amountMinor: 500_000,
      currency: "NGN",
      status: "succeeded",
    });
    expect(evt.metadata.purpose).toBe("fee");
  });

  it("rejects a tampered payload", () => {
    const { signature } = signedBody(chargeSuccess);
    const tampered = JSON.stringify({ ...chargeSuccess, data: { ...chargeSuccess.data, amount: 1 } });
    expect(() => provider.verifyAndParseWebhook(tampered, signature)).toThrow(HttpError);
  });

  it("rejects a missing signature", () => {
    const { rawBody } = signedBody(chargeSuccess);
    expect(() => provider.verifyAndParseWebhook(rawBody, undefined)).toThrow(HttpError);
  });

  it("marks non-success events as failed", () => {
    const failed = { ...chargeSuccess, event: "charge.failed" };
    const { rawBody, signature } = signedBody(failed);
    expect(provider.verifyAndParseWebhook(rawBody, signature).status).toBe("failed");
  });
});

describe("PaystackProvider parseEvent (PaymentProvider interface)", () => {
  it("produces an idempotency key scoped to the provider", () => {
    const evt = provider.parseEvent(signedBody(chargeSuccess));
    expect(evt.idempotencyKey).toBe("paystack:ref-123");
    expect(evt.studentId).toBe("11111111-1111-1111-1111-111111111111");
  });
});

describe("PaystackProvider initiatePayment", () => {
  it("returns the hosted checkout URL", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: true, data: { authorization_url: "https://checkout.paystack.test/x", reference: "ref-9" } }),
    }));
    const result = await provider.initiatePayment({
      amountMinor: 500_000,
      currency: "NGN",
      reference: "ref-9",
      idempotencyKey: "ref-9",
      customer: { email: "parent@example.com" },
    });
    expect(result).toEqual({ providerRef: "ref-9", redirectUrl: "https://checkout.paystack.test/x" });
  });

  it("fails fast when the customer has no email", async () => {
    await expect(
      provider.initiatePayment({
        amountMinor: 1,
        currency: "NGN",
        reference: "r",
        idempotencyKey: "r",
        customer: {},
      }),
    ).rejects.toThrow(/email/);
  });

  it("surfaces gateway errors with context", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      statusText: "Bad Request",
      json: async () => ({ status: false, message: "Invalid amount" }),
    }));
    await expect(
      provider.initiatePayment({
        amountMinor: 1,
        currency: "NGN",
        reference: "r",
        idempotencyKey: "r",
        customer: { email: "a@b.c" },
      }),
    ).rejects.toThrow(/Invalid amount/);
  });

  it("only supports NGN", () => {
    expect(provider.supports("NGN")).toBe(true);
    expect(provider.supports("KES")).toBe(false);
  });
});
