import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "../../db/client.js";
import { accounts, memberships } from "../../db/schema/index.js";
import { withAccount } from "../../tenant/context.js";
import { hashPassword, verifyPassword } from "../../auth/password.js";
import { signAccessToken } from "../../auth/jwt.js";
import { HttpError } from "../../lib/http-error.js";

export const loginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  /** Optional: pick which school to enter when the account has several. */
  schoolId: z.string().uuid().optional(),
});
export type LoginInput = z.infer<typeof loginInput>;

export interface MembershipSummary {
  schoolId: string;
  orgId: string;
  role: string;
  orgWide: boolean;
}

export interface LoginResult {
  accessToken: string;
  accountId: string;
  active: MembershipSummary;
  memberships: MembershipSummary[];
}

export const authService = {
  /** Creates a global login identity. Used by onboarding / registration. */
  async createAccount(email: string, password: string): Promise<{ id: string }> {
    const passwordHash = await hashPassword(password);
    const [row] = await db
      .insert(accounts)
      .values({ email: email.toLowerCase(), passwordHash })
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

    // Constant-ish failure path (don't leak which part was wrong).
    if (!account || account.status !== "active") throw new HttpError(401, "Invalid credentials");
    if (!(await verifyPassword(input.password, account.passwordHash))) {
      throw new HttpError(401, "Invalid credentials");
    }

    const rows = await withAccount(account.id, (tx) =>
      tx
        .select()
        .from(memberships)
        .where(and(eq(memberships.accountId, account.id), eq(memberships.status, "active"))),
    );
    if (rows.length === 0) throw new HttpError(403, "This account has no school access");

    const summaries: MembershipSummary[] = rows.map((m) => ({
      schoolId: m.schoolId,
      orgId: m.orgId,
      role: m.roleName,
      orgWide: m.orgWide === "on",
    }));

    const active = input.schoolId
      ? summaries.find((m) => m.schoolId === input.schoolId)
      : summaries[0];
    if (!active) throw new HttpError(403, "No access to the requested school");

    const accessToken = await signAccessToken({
      sub: account.id,
      schoolId: active.schoolId,
      orgId: active.orgId,
      role: active.role,
      orgWide: active.orgWide,
    });

    return { accessToken, accountId: account.id, active, memberships: summaries };
  },

  /** Returns the authenticated principal's memberships (for /auth/me). */
  async membershipsFor(accountId: string): Promise<MembershipSummary[]> {
    const rows = await withAccount(accountId, (tx) =>
      tx.select().from(memberships).where(eq(memberships.accountId, accountId)),
    );
    return rows.map((m) => ({
      schoolId: m.schoolId,
      orgId: m.orgId,
      role: m.roleName,
      orgWide: m.orgWide === "on",
    }));
  },
};
