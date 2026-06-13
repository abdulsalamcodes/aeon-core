import { Router } from "express";
import { authenticate } from "../../auth/middleware.js";
import { HttpError } from "../../lib/http-error.js";
import { authService, loginInput } from "./auth.service.js";

/**
 * Auth surface. `/login` is public; `/me` requires a valid token. Neither
 * needs tenant binding — login chooses the tenant, /me reports memberships.
 */
export const authRouter: Router = Router();

authRouter.post("/login", async (req, res, next) => {
  try {
    const parsed = loginInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    res.json({ data: await authService.login(parsed.data) });
  } catch (err) {
    next(err);
  }
});

authRouter.get("/me", authenticate, async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, "Unauthenticated");
    res.json({
      data: {
        accountId: req.auth.accountId,
        active: {
          schoolId: req.auth.schoolId,
          orgId: req.auth.orgId,
          role: req.auth.role,
          orgWide: req.auth.orgWide ?? false,
        },
        memberships: await authService.membershipsFor(req.auth.accountId),
      },
    });
  } catch (err) {
    next(err);
  }
});
