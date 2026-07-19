import { describe, it, expect } from "vitest";
import { R2StorageProvider } from "./r2-provider.js";

// No AWS SDK mock here: getSignedUrl computes a SigV4 URL locally (no network),
// so we assert against a genuinely signed R2 target.
const provider = new R2StorageProvider({
  accountId: "acct123",
  accessKeyId: "key",
  secretAccessKey: "secret",
  bucket: "photos-bucket",
  publicBaseUrl: "https://cdn.aeon.test",
});

describe("R2StorageProvider.createImageUploadTarget", () => {
  it("returns a signed R2 PUT URL and the matching public URL for the same key", async () => {
    const target = await provider.createImageUploadTarget({ contentType: "image/png", prefix: "photos" });

    const key = new URL(target.publicUrl).pathname.slice(1); // strip leading "/"
    expect(key).toMatch(/^photos\/[0-9a-f-]+\.png$/);
    expect(target.publicUrl).toBe(`https://cdn.aeon.test/${key}`);

    expect(target.uploadUrl).toContain("acct123.r2.cloudflarestorage.com");
    expect(target.uploadUrl).toContain(encodeURIComponent(key).replace(/%2F/g, "/"));
    expect(target.uploadUrl).toContain("X-Amz-Signature=");
  });

  it("advertises the capability and a bounded lifetime", async () => {
    const target = await provider.createImageUploadTarget({ contentType: "image/jpeg", prefix: "photos" });
    expect(provider.supportsDirectUpload).toBe(true);
    expect(target.headers["Content-Type"]).toBe("image/jpeg");
    expect(target.expiresInSeconds).toBeGreaterThan(0);
  });
});
