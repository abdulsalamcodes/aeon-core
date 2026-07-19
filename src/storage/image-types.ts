const FALLBACK_EXTENSION = "bin";

/** Image content types the platform accepts, mapped to their file extension. */
export const IMAGE_EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function isSupportedImageType(contentType: string): boolean {
  return contentType in IMAGE_EXTENSION_BY_CONTENT_TYPE;
}

export function imageExtension(contentType: string): string {
  return IMAGE_EXTENSION_BY_CONTENT_TYPE[contentType] ?? FALLBACK_EXTENSION;
}
