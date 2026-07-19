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

export interface UploadRequest {
  readonly contentType: string;
  readonly prefix: string;
}

/**
 * A one-time, short-lived target the browser uploads bytes to directly, so the
 * file never passes through the API. `publicUrl` is where the object is read
 * afterwards; `headers` must be sent verbatim on the PUT.
 */
export interface PresignedUpload {
  readonly uploadUrl: string;
  readonly publicUrl: string;
  readonly headers: Record<string, string>;
  readonly expiresInSeconds: number;
}

export interface ObjectStorageProvider {
  readonly name: string;
  /** Whether this backend can issue presigned URLs for direct browser uploads. */
  readonly supportsDirectUpload: boolean;
  /** Persists an image under `prefix/` and returns its retrievable URL. */
  putImage(image: DecodedImage, prefix: string): Promise<string>;
  /** Issues a presigned target for a direct browser → storage upload. */
  createImageUploadTarget(request: UploadRequest): Promise<PresignedUpload>;
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
