import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import type { DecodedImage, ObjectStorageProvider } from "./provider.js";

// R2 ignores region but the S3 client requires one; "auto" is Cloudflare's convention.
const R2_REGION = "auto";
const DEFAULT_EXTENSION = "bin";
const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
}

/** Cloudflare R2 via its S3-compatible API (ADR-12). */
export class R2StorageProvider implements ObjectStorageProvider {
  readonly name = "r2";
  private readonly client: S3Client;

  constructor(private readonly config: R2Config) {
    this.client = new S3Client({
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      region: R2_REGION,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });
  }

  async putImage(image: DecodedImage, prefix: string): Promise<string> {
    const key = `${prefix}/${randomUUID()}.${extensionFor(image.contentType)}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: image.bytes,
        ContentType: image.contentType,
      }),
    );
    return `${this.config.publicBaseUrl.replace(/\/$/, "")}/${key}`;
  }
}

function extensionFor(contentType: string): string {
  return EXTENSION_BY_CONTENT_TYPE[contentType] ?? DEFAULT_EXTENSION;
}
