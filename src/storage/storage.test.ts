import { describe, it, expect, vi, beforeEach } from "vitest";
import { decodeDataUrl } from "./data-url.js";
import { InlineStorageProvider } from "./inline-provider.js";
import { HttpError } from "../lib/http-error.js";

const sentCommands: unknown[] = [];

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(() => ({ send: vi.fn(async (command: unknown) => sentCommands.push(command)) })),
  PutObjectCommand: vi.fn((input: unknown) => ({ input })),
}));

const PNG_DATA_URL = "data:image/png;base64,aGVsbG8="; // "hello"

describe("decodeDataUrl", () => {
  it("parses content type and bytes from a base64 data URL", () => {
    const image = decodeDataUrl(PNG_DATA_URL);
    expect(image.contentType).toBe("image/png");
    expect(image.bytes.toString()).toBe("hello");
  });

  it("rejects anything that is not a base64 data URL", () => {
    expect(() => decodeDataUrl("https://example.com/x.png")).toThrow(HttpError);
  });
});

describe("InlineStorageProvider", () => {
  it("round-trips the image back to the same data URL", async () => {
    const provider = new InlineStorageProvider();
    const url = await provider.putImage(decodeDataUrl(PNG_DATA_URL), "photos");
    expect(url).toBe(PNG_DATA_URL);
  });
});

describe("R2StorageProvider", () => {
  beforeEach(() => {
    sentCommands.length = 0;
  });

  const config = {
    accountId: "acct",
    accessKeyId: "key",
    secretAccessKey: "secret",
    bucket: "photos-bucket",
    publicBaseUrl: "https://cdn.aeon.test",
  };

  it("uploads under the prefix and returns the public URL with the right extension", async () => {
    const { R2StorageProvider } = await import("./r2-provider.js");
    const provider = new R2StorageProvider(config);
    const url = await provider.putImage(decodeDataUrl(PNG_DATA_URL), "photos");
    expect(url).toMatch(/^https:\/\/cdn\.aeon\.test\/photos\/[0-9a-f-]+\.png$/);
    expect(sentCommands).toHaveLength(1);
  });

  it("falls back to a generic extension for unknown content types", async () => {
    const { R2StorageProvider } = await import("./r2-provider.js");
    const provider = new R2StorageProvider(config);
    const url = await provider.putImage(decodeDataUrl("data:application/zip;base64,aGVsbG8="), "docs");
    expect(url).toMatch(/\/docs\/[0-9a-f-]+\.bin$/);
  });
});
