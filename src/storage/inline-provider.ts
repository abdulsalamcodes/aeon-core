import type { DecodedImage, ObjectStorageProvider } from "./provider.js";

/**
 * Dev/test fallback: returns the image inline as a data URL, so the app runs
 * with no storage backend (ADR-12). Not for production — bytes live in the DB.
 */
export class InlineStorageProvider implements ObjectStorageProvider {
  readonly name = "inline";

  async putImage(image: DecodedImage): Promise<string> {
    return `data:${image.contentType};base64,${image.bytes.toString("base64")}`;
  }
}
