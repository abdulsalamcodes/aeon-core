import { SignJWT, jwtVerify } from "jose";
import { env } from "../config/env.js";

const secret = new TextEncoder().encode(env.JWT_SECRET);
const ALG = "HS256";

/**
 * Access-token claims (ADR-4). The principal is the account; the active school
 * + role come from the chosen membership. `tenantResolver` reads these to bind
 * RLS for the request — no extra DB hit on the hot path.
 */
export interface AccessClaims {
  sub: string; // account id
  schoolId: string;
  orgId: string;
  role: string; // role name of the active membership
  orgWide: boolean;
}

export async function signAccessToken(claims: AccessClaims): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(env.JWT_TTL)
    .sign(secret);
}

export async function verifyAccessToken(token: string): Promise<AccessClaims> {
  const { payload } = await jwtVerify(token, secret, { algorithms: [ALG] });
  return {
    sub: String(payload.sub),
    schoolId: String(payload.schoolId),
    orgId: String(payload.orgId),
    role: String(payload.role),
    orgWide: Boolean(payload.orgWide),
  };
}
