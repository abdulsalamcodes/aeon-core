import { z } from "zod";
import { eq, and, gt } from "drizzle-orm";
import { db } from "../../db/client.js";
import { accounts, memberships, schools } from "../../db/schema/index.js";
import { env } from "../../config/env.js";
import { HttpError } from "../../lib/http-error.js";
import { sendEmail } from "../../email/email.js";
import { generateToken, hashToken } from "../../auth/token.js";
import { provisionService } from "./provision.service.js";
import { schoolService } from "../org/school.service.js";
import { isPaidPlan } from "../org/billing.service.js";

const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const FREE_PLAN = "starter";

// Self-service tiers only. Enterprise is assisted (demo → super-admin onboarding).
const SIGNUP_PLANS = [FREE_PLAN, "growth"] as const;

export const signupInput = z.object({
  schoolName: z.string().trim().min(2),
  adminName: z.string().trim().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  plan: z.enum(SIGNUP_PLANS),
});
export type SignupInput = z.infer<typeof signupInput>;

export interface SignupResult {
  schoolSlug: string;
  plan: string;
  paymentRequired: boolean;
}

async function emailAlreadyRegistered(email: string): Promise<boolean> {
  const rows = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.email, email.toLowerCase())).limit(1);
  return rows.length > 0;
}

async function issueVerificationToken(accountId: string): Promise<string> {
  const token = generateToken();
  await db
    .update(accounts)
    .set({ verifyTokenHash: hashToken(token), verifyExpires: new Date(Date.now() + VERIFY_TOKEN_TTL_MS) })
    .where(eq(accounts.id, accountId));
  return token;
}

async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const link = `${env.WEB_APP_URL}/verify-email?token=${token}`;
  await sendEmail(email, "Verify your Aeon account", `Confirm your email to activate your school: ${link}`);
}

export const signupService = {
  /**
   * Self-service school creation. Provisions the school + admin as UNVERIFIED,
   * records the chosen plan, and emails a verification link. Login is blocked
   * until the email is confirmed (see authService.login).
   */
  async signup(input: SignupInput): Promise<SignupResult> {
    if (await emailAlreadyRegistered(input.email)) {
      throw new HttpError(409, "An account with this email already exists. Try signing in instead.");
    }

    const school = await provisionService.provisionSchool({
      schoolName: input.schoolName,
      adminName: input.adminName,
      adminEmail: input.email,
      adminPassword: input.password,
      emailVerified: false,
    });

    const paymentRequired = isPaidPlan(input.plan);
    await schoolService.updateSettings(school.schoolId, {
      billing: { plan: input.plan, status: paymentRequired ? "pending" : "active" },
    });

    const token = await issueVerificationToken(school.accountId);
    await sendVerificationEmail(input.email, token);

    return { schoolSlug: school.slug, plan: input.plan, paymentRequired };
  },

  /**
   * Confirms an email from its token, unlocking login. Returns where to send
   * the operator next: their school's staff login, and whether a paid plan
   * still needs checkout.
   */
  async verifyEmail(token: string): Promise<SignupResult> {
    const [account] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.verifyTokenHash, hashToken(token)), gt(accounts.verifyExpires, new Date())))
      .limit(1);
    if (!account) throw new HttpError(400, "This verification link is invalid or has expired.");

    await db
      .update(accounts)
      .set({ emailVerified: true, verifyTokenHash: null, verifyExpires: null })
      .where(eq(accounts.id, account.id));

    return destinationFor(account.id);
  },
};

async function destinationFor(accountId: string): Promise<SignupResult> {
  const [membership] = await db
    .select({ schoolId: memberships.schoolId, slug: schools.slug })
    .from(memberships)
    .innerJoin(schools, eq(schools.id, memberships.schoolId))
    .where(eq(memberships.accountId, accountId))
    .limit(1);
  if (!membership) throw new HttpError(500, "Verified account has no school");

  const settings = await schoolService.getSettings(membership.schoolId);
  const billing = (settings.billing ?? {}) as { plan?: string; status?: string };
  return {
    schoolSlug: membership.slug,
    plan: billing.plan ?? FREE_PLAN,
    paymentRequired: billing.status === "pending",
  };
}
