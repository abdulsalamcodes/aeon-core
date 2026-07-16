import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env.js";

const ALLOWED_HEADERS = "Content-Type, Authorization, X-School-Id, X-Org-Id";
const ALLOWED_METHODS = "GET, POST, PATCH, PUT, DELETE, OPTIONS";
const NO_CONTENT = 204;

/**
 * An empty allowlist (dev) reflects any origin; a configured allowlist (required
 * in production) admits only listed origins. Requests from other origins get no
 * CORS headers, so the browser blocks them.
 */
function isOriginAllowed(origin: string): boolean {
  return env.CORS_ORIGINS.length === 0 || env.CORS_ORIGINS.includes(origin);
}

export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;
  if (origin && isOriginAllowed(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Headers", ALLOWED_HEADERS);
    res.setHeader("Access-Control-Allow-Methods", ALLOWED_METHODS);
  }
  res.setHeader("Vary", "Origin");
  if (req.method === "OPTIONS") {
    res.sendStatus(NO_CONTENT);
    return;
  }
  next();
}
