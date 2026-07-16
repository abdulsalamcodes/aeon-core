import { HttpError } from "../lib/http-error.js";
import type { DecodedImage } from "./provider.js";

const DATA_URL_PATTERN = /^data:([^;]+);base64,(.+)$/s;

/** Parses a `data:<mime>;base64,<payload>` URL into its content type and bytes. */
export function decodeDataUrl(dataUrl: string): DecodedImage {
  const match = DATA_URL_PATTERN.exec(dataUrl);
  const contentType = match?.[1];
  const base64 = match?.[2];
  if (!contentType || !base64) throw new HttpError(400, "Expected a base64 data URL");
  return { contentType, bytes: Buffer.from(base64, "base64") };
}
