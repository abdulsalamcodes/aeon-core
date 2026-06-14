import type { Request, Response, NextFunction } from "express";
import { runWithTenant, type TenantContext } from "./context.js";

/**
 * Resolves the active tenant for the request and runs the rest of the pipeline
 * inside its AsyncLocalStorage context.
 *
 * Resolution order (mirrors the legacy tenantResolver, generalized to the
 * org→school hierarchy):
 *   1. Authenticated principal's membership (JWT claim) — the normal path.
 *   2. `x-school-id` header (trusted, set by the web edge from the slug).
 *
 * In Phase 1 this is fed by the real auth/membership layer; for the Phase 0
 * skeleton it accepts explicit headers so the subjects module is exercisable.
 */
export function tenantResolver(req: Request, res: Response, next: NextFunction) {
  const schoolId = (req.headers["x-school-id"] as string | undefined) ?? req.auth?.schoolId;
  const orgId = (req.headers["x-org-id"] as string | undefined) ?? req.auth?.orgId;

  if (!schoolId || !orgId) {
    res.status(400).json({ error: "Tenant could not be resolved" });
    return;
  }

  const ctx: TenantContext = {
    schoolId,
    orgId,
    orgWide: req.auth?.orgWide ?? false,
    actorId: req.auth?.accountId,
    actorName: req.auth?.name,
  };
  runWithTenant(ctx, () => next());
}
