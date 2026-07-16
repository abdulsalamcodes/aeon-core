import { createHash, randomBytes } from "node:crypto";

const TOKEN_BYTES = 32;

/** A random, URL-safe secret to email to the user (the raw token). */
export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString("hex");
}

/** The at-rest form of a token — we store only the hash, never the raw value. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
