import { env } from "../config/env.js";
import { registerProvider } from "./provider.js";
import { StubProvider } from "./stub.js";
import { PaystackProvider } from "./paystack.js";

export * from "./provider.js";
export { StubProvider } from "./stub.js";
export { PaystackProvider, type PaystackChargeEvent } from "./paystack.js";

let registered = false;

/**
 * Registers the configured payment providers at boot. Paystack registers
 * first so it wins currency routing for NGN; the stub stays last as the
 * catch-all for dev/embedded mode (ADR-11).
 */
export function registerDefaultProviders(): void {
  if (registered) return;
  if (env.PAYSTACK_SECRET_KEY) {
    registerProvider(new PaystackProvider(env.PAYSTACK_SECRET_KEY, env.PAYSTACK_BASE_URL));
  }
  registerProvider(new StubProvider());
  registered = true;
}
