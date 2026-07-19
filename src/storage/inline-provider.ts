import type { DecodedImage, ObjectStorageProvider, PresignedUpload } from "./provider.js";
import { HttpError } from "../lib/http-error.js";

/**
 * Dev/test fallback: returns the image inline as a data URL, so the app runs
 * with no storage backend (ADR-12). Not for production — bytes live in the DB.
 */
export class InlineStorageProvider implements ObjectStorageProvider {
  readonly name = "inline";
  readonly supportsDirectUpload = false;

  async putImage(image: DecodedImage): Promise<string> {
    return `data:${image.contentType};base64,${image.bytes.toString("base64")}`;
  }

  async createImageUploadTarget(): Promise<PresignedUpload> {
    throw new HttpError(501, "Direct upload requires object storage; use the inline upload path instead.");
  }
}
