import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { DecodedImage, ObjectStorageProvider, PresignedUpload, UploadRequest } from "./provider.js";
import { imageExtension } from "./image-types.js";

// R2 ignores region but the S3 client requires one; "auto" is Cloudflare's convention.
const R2_REGION = "auto";
const UPLOAD_URL_TTL_SECONDS = 300;

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
  readonly supportsDirectUpload = true;
  private readonly client: S3Client;

  constructor(private readonly config: R2Config) {
    this.client = new S3Client({
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      region: R2_REGION,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });
  }

  async putImage(image: DecodedImage, prefix: string): Promise<string> {
    const key = imageKey(prefix, image.contentType);
    await this.client.send(
      new PutObjectCommand({ Bucket: this.config.bucket, Key: key, Body: image.bytes, ContentType: image.contentType }),
    );
    return this.publicUrl(key);
  }

  async createImageUploadTarget(request: UploadRequest): Promise<PresignedUpload> {
    const key = imageKey(request.prefix, request.contentType);
    const command = new PutObjectCommand({ Bucket: this.config.bucket, Key: key, ContentType: request.contentType });
    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: UPLOAD_URL_TTL_SECONDS });
    return {
      uploadUrl,
      publicUrl: this.publicUrl(key),
      headers: { "Content-Type": request.contentType },
      expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
    };
  }

  private publicUrl(key: string): string {
    return `${this.config.publicBaseUrl.replace(/\/$/, "")}/${key}`;
  }
}

function imageKey(prefix: string, contentType: string): string {
  return `${prefix}/${randomUUID()}.${imageExtension(contentType)}`;
}
