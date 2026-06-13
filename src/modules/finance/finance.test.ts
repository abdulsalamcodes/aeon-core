import { describe, it, expect } from "vitest";
import { computeBalances } from "./balance.js";
import type { LedgerEntry } from "../../db/schema/ledgerEntries.js";
import { registerProvider, providerFor, providerByName } from "../../payments/index.js";
import { StubProvider } from "../../payments/index.js";

function entry(p: Partial<LedgerEntry>): LedgerEntry {
  return {
    id: "x",
    schoolId: "s",
    studentId: "st",
    termId: "t",
    direction: "debit",
    kind: "fee",
    amountMinor: 0,
    currency: "NGN",
    reference: null,
    idempotencyKey: null,
    meta: {},
    createdAt: new Date(),
    ...p,
  } as LedgerEntry;
}

describe("computeBalances (ledger, ADR-8)", () => {
  it("nets debits and credits per currency", () => {
    const balances = computeBalances([
      entry({ direction: "debit", kind: "fee", amountMinor: 50000, currency: "NGN" }),
      entry({ direction: "credit", kind: "payment", amountMinor: 20000, currency: "NGN" }),
    ]);
    expect(balances).toHaveLength(1);
    expect(balances[0]).toMatchObject({ currency: "NGN", billedMinor: 50000, paidMinor: 20000, balanceMinor: 30000 });
  });

  it("never sums across currencies", () => {
    const balances = computeBalances([
      entry({ direction: "debit", amountMinor: 50000, currency: "NGN" }),
      entry({ direction: "debit", amountMinor: 3000, currency: "GHS" }),
    ]).sort((a, b) => a.currency.localeCompare(b.currency));
    expect(balances.map((b) => b.currency)).toEqual(["GHS", "NGN"]);
    expect(balances.find((b) => b.currency === "GHS")?.balanceMinor).toBe(3000);
  });

  it("uses integer minor units (no floats)", () => {
    const [b] = computeBalances([entry({ direction: "debit", amountMinor: 12345, currency: "USD" })]);
    expect(Number.isInteger(b!.balanceMinor)).toBe(true);
  });
});

describe("PaymentProvider registry (ADR-11)", () => {
  registerProvider(new StubProvider());

  it("routes by currency and resolves by name", () => {
    expect(providerFor("NGN").name).toBe("stub");
    expect(providerByName("stub").name).toBe("stub");
  });

  it("normalizes a webhook into one canonical event", () => {
    const evt = providerByName("stub").parseEvent({
      idempotencyKey: "evt_123",
      providerRef: "ref_1",
      amountMinor: 20000,
      currency: "NGN",
      studentId: "stu_1",
      status: "succeeded",
    });
    expect(evt).toMatchObject({ idempotencyKey: "evt_123", amountMinor: 20000, status: "succeeded" });
  });
});
