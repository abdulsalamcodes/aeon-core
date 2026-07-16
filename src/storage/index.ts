import { env } from "../config/env.js";
import { setStorageProvider, type ObjectStorageProvider } from "./provider.js";
import { R2StorageProvider } from "./r2-provider.js";
import { InlineStorageProvider } from "./inline-provider.js";

export * from "./provider.js";
export { decodeDataUrl } from "./data-url.js";
export { R2StorageProvider, type R2Config } from "./r2-provider.js";
export { InlineStorageProvider } from "./inline-provider.js";

let registered = false;

/**
 * Selects the object-storage provider at boot: Cloudflare R2 when fully
 * configured, otherwise an inline data-URL fallback so dev/tests need no infra.
 * Adopting another S3-compatible store means adding a provider here (ADR-12).
 */
export function registerDefaultStorage(): void {
  if (registered) return;
  setStorageProvider(configuredR2() ?? new InlineStorageProvider());
  registered = true;
}

function configuredR2(): ObjectStorageProvider | null {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE_URL } = env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET || !R2_PUBLIC_BASE_URL) {
    return null;
  }
  return new R2StorageProvider({
    accountId: R2_ACCOUNT_ID,
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    bucket: R2_BUCKET,
    publicBaseUrl: R2_PUBLIC_BASE_URL,
  });
}
