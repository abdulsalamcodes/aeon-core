import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "./password.js";
import { signAccessToken, verifyAccessToken, signRefreshToken, verifyRefreshToken } from "./jwt.js";
import { loginInput } from "../modules/identity/index.js";

describe("password hashing (scrypt)", () => {
  it("verifies a correct password and rejects a wrong one", async () => {
    const hash = await hashPassword("Sup3r-Secret!");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("Sup3r-Secret!", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  it("produces a unique salt per hash", async () => {
    const a = await hashPassword("same");
    const b = await hashPassword("same");
    expect(a).not.toBe(b);
  });

  it("rejects malformed stored hashes", async () => {
    expect(await verifyPassword("x", "not-a-hash")).toBe(false);
  });
});

describe("access token (jose HS256)", () => {
  it("round-trips claims", async () => {
    const token = await signAccessToken({
      sub: "11111111-1111-1111-1111-111111111111",
      schoolId: "22222222-2222-2222-2222-222222222222",
      orgId: "33333333-3333-3333-3333-333333333333",
      role: "teacher",
      orgWide: false,
    });
    const claims = await verifyAccessToken(token);
    expect(claims.role).toBe("teacher");
    expect(claims.schoolId).toBe("22222222-2222-2222-2222-222222222222");
  });

  it("rejects a tampered token", async () => {
    await expect(verifyAccessToken("not.a.jwt")).rejects.toBeDefined();
  });
});

describe("refresh token", () => {
  const accountId = "11111111-1111-1111-1111-111111111111";

  it("round-trips the subject", async () => {
    const token = await signRefreshToken(accountId);
    expect(await verifyRefreshToken(token)).toBe(accountId);
  });

  it("rejects an access token presented as a refresh token", async () => {
    const access = await signAccessToken({
      sub: accountId,
      schoolId: "22222222-2222-2222-2222-222222222222",
      orgId: "33333333-3333-3333-3333-333333333333",
      role: "teacher",
      orgWide: false,
    });
    await expect(verifyRefreshToken(access)).rejects.toBeDefined();
  });
});

describe("loginInput", () => {
  it("requires a valid email and non-empty password", () => {
    expect(loginInput.safeParse({ email: "a@b.com", password: "x" }).success).toBe(true);
    expect(loginInput.safeParse({ email: "nope", password: "x" }).success).toBe(false);
    expect(loginInput.safeParse({ email: "a@b.com", password: "" }).success).toBe(false);
  });
});
