import { describe, it, expect, beforeAll, vi } from "vitest";
import { applyMigrations } from "../../db/run-migrations.js";
import { HttpError } from "../../lib/http-error.js";

const sentEmails: { to: string; body: string }[] = [];
vi.mock("../../email/email.js", () => ({
  isEmailConfigured: () => false,
  sendEmail: vi.fn(async (to: string, _subject: string, body: string) => {
    sentEmails.push({ to, body });
  }),
}));

// Imported after the mock is registered so the service picks up the fake sender.
const { signupService } = await import("./signup.service.js");
const { authService } = await import("./auth.service.js");
const { provisionService } = await import("./provision.service.js");

beforeAll(async () => {
  await applyMigrations();
});

function verificationTokenFromLastEmail(): string {
  const body = sentEmails.at(-1)?.body ?? "";
  const match = body.match(/token=([a-f0-9]+)/);
  if (!match?.[1]) throw new Error("no verification token in the last email");
  return match[1];
}

const password = "Secret-123";

describe("self-service signup", () => {
  it("creates a school but blocks login until the email is verified", async () => {
    const result = await signupService.signup({
      schoolName: "Sunrise Academy",
      adminName: "Ada Owner",
      email: "ada@sunrise.test",
      password,
      plan: "starter",
    });
    expect(result.schoolSlug).toBe("sunrise-academy");
    expect(result.paymentRequired).toBe(false);

    await expect(authService.login({ email: "ada@sunrise.test", password })).rejects.toThrow(/verify your email/i);

    const verified = await signupService.verifyEmail(verificationTokenFromLastEmail());
    expect(verified.schoolSlug).toBe("sunrise-academy");

    const session = await authService.login({ email: "ada@sunrise.test", password });
    expect(session.accessToken).toBeTruthy();
    expect(session.active.role).toBe("school-admin");
  });

  it("de-duplicates the slug for a same-named school", async () => {
    const result = await signupService.signup({
      schoolName: "Sunrise Academy",
      adminName: "Second Owner",
      email: "second@sunrise.test",
      password,
      plan: "starter",
    });
    expect(result.schoolSlug).toBe("sunrise-academy-2");
  });

  it("marks a paid plan as pending payment", async () => {
    const result = await signupService.signup({
      schoolName: "Growth School",
      adminName: "Pay Owner",
      email: "pay@growth.test",
      password,
      plan: "growth",
    });
    expect(result.paymentRequired).toBe(true);

    const verified = await signupService.verifyEmail(verificationTokenFromLastEmail());
    expect(verified.plan).toBe("growth");
    expect(verified.paymentRequired).toBe(true);
  });

  it("rejects a duplicate email", async () => {
    await expect(
      signupService.signup({ schoolName: "Dup School", adminName: "Dup Owner", email: "ada@sunrise.test", password, plan: "starter" }),
    ).rejects.toThrow(HttpError);
  });

  it("rejects an invalid verification token", async () => {
    await expect(signupService.verifyEmail("deadbeef")).rejects.toThrow(/invalid or has expired/i);
  });
});

describe("assisted provisioning (enterprise path)", () => {
  it("creates a verified admin that can sign in immediately", async () => {
    await provisionService.provisionSchool({
      schoolName: "Assisted School",
      adminName: "Enterprise Admin",
      adminEmail: "ent@assisted.test",
      adminPassword: password,
      emailVerified: true,
    });
    const session = await authService.login({ email: "ent@assisted.test", password });
    expect(session.accessToken).toBeTruthy();
  });
});
