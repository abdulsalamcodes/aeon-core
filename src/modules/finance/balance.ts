import type { LedgerEntry } from "../../db/schema/ledgerEntries.js";

export interface CurrencyBalance {
  currency: string;
  billedMinor: number; // Σ debits
  paidMinor: number; // Σ credits
  balanceMinor: number; // debits − credits (what's still owed)
}

/**
 * Derives balances from immutable ledger entries (ADR-8). Netting is done
 * PER CURRENCY — entries in different currencies are never summed together.
 * Pure function: no DB, fully unit-testable.
 */
export function computeBalances(entries: LedgerEntry[]): CurrencyBalance[] {
  const byCurrency = new Map<string, CurrencyBalance>();
  for (const e of entries) {
    const b =
      byCurrency.get(e.currency) ??
      { currency: e.currency, billedMinor: 0, paidMinor: 0, balanceMinor: 0 };
    if (e.direction === "debit") {
      b.billedMinor += e.amountMinor;
      b.balanceMinor += e.amountMinor;
    } else {
      b.paidMinor += e.amountMinor;
      b.balanceMinor -= e.amountMinor;
    }
    byCurrency.set(e.currency, b);
  }
  return [...byCurrency.values()];
}
