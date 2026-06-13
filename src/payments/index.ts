import { registerProvider } from "./provider.js";
import { StubProvider } from "./stub.js";

export * from "./provider.js";
export { StubProvider } from "./stub.js";

let registered = false;

/**
 * Registers the configured payment providers at boot. Today: a stub. Adding
 * Paystack/Flutterwave/Stripe means registering them here — finance/ledger
 * code doesn't change (ADR-11).
 */
export function registerDefaultProviders(): void {
  if (registered) return;
  registerProvider(new StubProvider());
  registered = true;
}
