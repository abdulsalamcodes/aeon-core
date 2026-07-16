/**
 * Object-storage abstraction (ADR-12). Callers store images through THIS
 * interface and never know which backend is live. Cloudflare R2 is the first
 * implementation; AWS S3, MinIO, or any S3-compatible store slot in by adding a
 * provider class — upload callers don't change.
 */
export interface DecodedImage {
  readonly contentType: string;
  readonly bytes: Buffer;
}

export interface ObjectStorageProvider {
  readonly name: string;
  /** Persists an image under `prefix/` and returns its retrievable URL. */
  putImage(image: DecodedImage, prefix: string): Promise<string>;
}

/**
 * Single active provider, chosen once at boot. Unlike payments (routed by
 * currency), storage has one destination per deployment.
 */
let activeProvider: ObjectStorageProvider | undefined;

export function setStorageProvider(provider: ObjectStorageProvider): void {
  activeProvider = provider;
}

export function storageProvider(): ObjectStorageProvider {
  if (!activeProvider) throw new Error("Object storage provider not registered");
  return activeProvider;
}
