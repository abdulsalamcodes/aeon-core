import { z } from "zod";
import { eq, and, gt } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { db } from "../../db/client.js";
import { accounts, memberships, schools, persons } from "../../db/schema/index.js";
import { withAccount } from "../../tenant/context.js";
import { hashPassword, verifyPassword } from "../../auth/password.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../auth/jwt.js";
import { HttpError } from "../../lib/http-error.js";
import { sendEmail } from "../../email/email.js";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export const loginInput = z
  .object({
    email: z.string().email(),
    password: z.string().min(1),
    /** Pick which school to enter when the account has several. */
    schoolId: z.string().uuid().optional(),
    schoolSlug: z.string().optional(),
  })
  .strip();
export type LoginInput = z.infer<typeof loginInput>;

export interface MembershipSummary {
  schoolId: string;
  orgId: string;
  schoolName: string;
  schoolSlug: string;
  role: string;
  orgWide: boolean;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  accountId: string;
  displayName: string;
  active: MembershipSummary;
  memberships: MembershipSummary[];
}

/** Picks the membership matching the requested school, defaulting to the first. */
function selectMembership(
  memberships: MembershipSummary[],
  choice: { schoolId?: string; schoolSlug?: string },
): MembershipSummary | undefined {
  if (choice.schoolSlug) return memberships.find((m) => m.schoolSlug === choice.schoolSlug);
  if (choice.schoolId) return memberships.find((m) => m.schoolId === choice.schoolId);
  return memberships[0];
}

/** Mints the access + refresh token pair for an authenticated principal. */
async function issueSession(
  accountId: string,
  displayName: string,
  memberships: MembershipSummary[],
  active: MembershipSummary,
): Promise<LoginResult> {
  const accessToken = await signAccessToken({
    sub: accountId,
    schoolId: active.schoolId,
    orgId: active.orgId,
    role: active.role,
    orgWide: active.orgWide,
    name: displayName,
  });
  const refreshToken = await signRefreshToken(accountId);
  return { accessToken, refreshToken, accountId, displayName, active, memberships };
}

/** Resolves a principal's memberships enriched with school + display name. */
async function principal(accountId: string): Promise<{ displayName: string; memberships: MembershipSummary[] }> {
  return withAccount(accountId, async (tx) => {
    const rows = await tx
      .select({
        schoolId: memberships.schoolId,
        orgId: memberships.orgId,
        role: memberships.roleName,
        orgWide: memberships.orgWide,
        status: memberships.status,
        schoolName: schools.name,
        schoolSlug: schools.slug,
        firstName: persons.firstName,
        lastName: persons.lastName,
      })
      .from(memberships)
      .innerJoin(schools, eq(schools.id, memberships.schoolId))
      .innerJoin(persons, eq(persons.id, memberships.personId))
      .where(eq(memberships.accountId, accountId));

    const active = rows.filter((r) => r.status === "active");
    const displayName = active[0] ? `${active[0].firstName} ${active[0].lastName}` : "";
    return {
      displayName,
      memberships: active.map((m) => ({
        schoolId: m.schoolId,
        orgId: m.orgId,
        schoolName: m.schoolName,
        schoolSlug: m.schoolSlug,
        role: m.role,
        orgWide: m.orgWide === "on",
      })),
    };
  });
}

export const authService = {
  /**
   * Creates a global login identity. Accounts are verified by default — the
   * assisted/enterprise path and internal provisioning vouch for the person.
   * Self-service signup passes `emailVerified: false` so the email gate applies.
   */
  async createAccount(email: string, password: string, emailVerified = true): Promise<{ id: string }> {
    const passwordHash = await hashPassword(password);
    const [row] = await db
      .insert(accounts)
      .values({ email: email.toLowerCase(), passwordHash, emailVerified })
      .returning({ id: accounts.id });
    if (!row) throw new HttpError(500, "Failed to create account");
    return row;
  },

  /**
   * Authenticates an account and mints an access token bound to one membership.
   * Membership lookup uses the `withAccount` RLS escape — a principal can read
   * its OWN memberships across schools before a tenant is chosen (ADR-4).
   */
  async login(input: LoginInput): Promise<LoginResult> {
    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.email, input.email.toLowerCase()))
      .limit(1);

    if (!account || account.status !== "active") throw new HttpError(401, "Invalid credentials");
    if (!(await verifyPassword(input.password, account.passwordHash))) {
      throw new HttpError(401, "Invalid credentials");
    }
    if (!account.emailVerified) throw new HttpError(403, "Please verify your email before signing in.");

    const { displayName, memberships: summaries } = await principal(account.id);
    if (summaries.length === 0) throw new HttpError(403, "This account has no school access");

    const active = selectMembership(summaries, input);
    if (!active) throw new HttpError(403, "This account does not have access to this school.");

    return issueSession(account.id, displayName, summaries, active);
  },

  /**
   * Exchanges a valid refresh token for a fresh session. Memberships are
   * re-derived so role/access changes apply; the caller may re-select the
   * active school by slug (defaults to the first membership).
   */
  async refresh(refreshToken: string, schoolSlug?: string): Promise<LoginResult> {
    const accountId = await verifyRefreshToken(refreshToken);
    const { displayName, memberships: summaries } = await principal(accountId);
    if (summaries.length === 0) throw new HttpError(403, "This account has no school access");

    const active = selectMembership(summaries, { schoolSlug }) ?? summaries[0];
    if (!active) throw new HttpError(403, "This account has no school access");
    return issueSession(accountId, displayName, summaries, active);
  },

  /** Returns the authenticated principal (for /auth/me). */
  async me(accountId: string): Promise<{ displayName: string; memberships: MembershipSummary[] }> {
    return principal(accountId);
  },

  /** Authenticated change of own password (verifies the current one). */
  async changePassword(accountId: string, currentPassword: string, newPassword: string): Promise<void> {
    const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
    if (!account) throw new HttpError(404, "Account not found");
    if (!(await verifyPassword(currentPassword, account.passwordHash))) throw new HttpError(401, "Current password is incorrect");
    await db.update(accounts).set({ passwordHash: await hashPassword(newPassword) }).where(eq(accounts.id, accountId));
  },

  /** Begins a reset: stores a token hash, emails the link. Always "succeeds"
   *  (no account enumeration). */
  async forgotPassword(email: string): Promise<void> {
    const [account] = await db.select().from(accounts).where(eq(accounts.email, email.toLowerCase())).limit(1);
    if (!account) return;
    const token = randomBytes(32).toString("hex");
    await db
      .update(accounts)
      .set({ resetTokenHash: sha(token), resetExpires: new Date(Date.now() + 60 * 60 * 1000) })
      .where(eq(accounts.id, account.id));
    await sendEmail(account.email, "Reset your Aeon password", `Use this token to reset your password: ${token}`);
  },

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const [account] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.resetTokenHash, sha(token)), gt(accounts.resetExpires, new Date())))
      .limit(1);
    if (!account) throw new HttpError(400, "Invalid or expired reset token");
    await db
      .update(accounts)
      .set({ passwordHash: await hashPassword(newPassword), resetTokenHash: null, resetExpires: null })
      .where(eq(accounts.id, account.id));
  },
};
