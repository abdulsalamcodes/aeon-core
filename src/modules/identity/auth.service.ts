import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { accounts, memberships, schools, persons } from "../../db/schema/index.js";
import { withAccount } from "../../tenant/context.js";
import { hashPassword, verifyPassword } from "../../auth/password.js";
import { signAccessToken } from "../../auth/jwt.js";
import { HttpError } from "../../lib/http-error.js";

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
  accountId: string;
  displayName: string;
  active: MembershipSummary;
  memberships: MembershipSummary[];
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

    if (!account || account.status !== "active") throw new HttpError(401, "Invalid credentials");
    if (!(await verifyPassword(input.password, account.passwordHash))) {
      throw new HttpError(401, "Invalid credentials");
    }

    const { displayName, memberships: summaries } = await principal(account.id);
    if (summaries.length === 0) throw new HttpError(403, "This account has no school access");

    const active = input.schoolSlug
      ? summaries.find((m) => m.schoolSlug === input.schoolSlug)
      : input.schoolId
        ? summaries.find((m) => m.schoolId === input.schoolId)
        : summaries[0];
    if (!active) throw new HttpError(403, "This account does not have access to this school.");

    const accessToken = await signAccessToken({
      sub: account.id,
      schoolId: active.schoolId,
      orgId: active.orgId,
      role: active.role,
      orgWide: active.orgWide,
    });

    return { accessToken, accountId: account.id, displayName, active, memberships: summaries };
  },

  /** Returns the authenticated principal (for /auth/me). */
  async me(accountId: string): Promise<{ displayName: string; memberships: MembershipSummary[] }> {
    return principal(accountId);
  },
};
