import type { Request, Response, NextFunction } from "express";

const TOO_MANY_REQUESTS = 429;

interface RateLimitOptions {
  /** Distinct bucket name so different routes don't share a budget. */
  name: string;
  max: number;
  windowMs: number;
}

interface Hit {
  count: number;
  resetAt: number;
}

/**
 * In-memory fixed-window limiter. Adequate for a single instance; a multi-node
 * deployment needs a shared store (Redis) — see roadmap. Keyed by client IP so
 * one caller can't exhaust the budget for others.
 */
export function rateLimit(options: RateLimitOptions) {
  const hits = new Map<string, Hit>();

  return function limit(req: Request, res: Response, next: NextFunction): void {
    const key = `${options.name}:${clientIp(req)}`;
    const now = Date.now();
    const existing = hits.get(key);

    if (!existing || existing.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    if (existing.count >= options.max) {
      const retryAfterSeconds = Math.ceil((existing.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfterSeconds));
      res.status(TOO_MANY_REQUESTS).json({ error: "Too many requests. Please try again later." });
      return;
    }

    existing.count += 1;
    next();
  };
}

function clientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0]!.trim();
  }
  return req.ip ?? "unknown";
}
