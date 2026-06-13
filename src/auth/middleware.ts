import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "./jwt.js";

/**
 * Authenticates the request from a Bearer token and populates `req.auth`.
 * Runs BEFORE `tenantResolver`, which then binds RLS from these claims.
 * Routes that don't need auth (e.g. /auth/login, /health) skip this.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }
  try {
    const claims = await verifyAccessToken(header.slice(7));
    req.auth = {
      accountId: claims.sub,
      schoolId: claims.schoolId,
      orgId: claims.orgId,
      role: claims.role,
      orgWide: claims.orgWide,
    };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: {
        accountId: string;
        schoolId: string;
        orgId: string;
        role: string;
        orgWide?: boolean;
      };
    }
  }
}
