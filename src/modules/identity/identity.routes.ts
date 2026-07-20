import { Router } from "express";
import { authenticate } from "../../auth/middleware.js";
import { HttpError } from "../../lib/http-error.js";
import { authService } from "./auth.service.js";
import { signupService } from "./signup.service.js";
import { loginInput, signupInput, refreshTokenInput, verifyEmailInput } from "./identity.schema.js";

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

authRouter.post("/signup", async (req, res, next) => {
  try {
    const parsed = signupInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    res.status(201).json({ data: await signupService.signup(parsed.data) });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/refresh", async (req, res, next) => {
  try {
    const parsed = refreshTokenInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    res.json({ data: await authService.refresh(parsed.data.refreshToken, parsed.data.schoolSlug) });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/forgot-password", async (req, res, next) => {
  try {
    if (req.body?.email) await authService.forgotPassword(String(req.body.email));
    res.json({ data: null, message: "If that account exists, a reset link has been sent." });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/reset-password/:token", async (req, res, next) => {
  try {
    await authService.resetPassword(req.params.token, String(req.body?.password ?? ""));
    res.json({ data: null });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/verify-email", async (req, res, next) => {
  try {
    const parsed = verifyEmailInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    res.json({ data: await signupService.verifyEmail(parsed.data.token) });
  } catch (err) {
    next(err);
  }
});

authRouter.patch("/change-password", authenticate, async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, "Unauthenticated");
    await authService.changePassword(req.auth.accountId, String(req.body?.currentPassword ?? ""), String(req.body?.password ?? ""));
    res.json({ data: null });
  } catch (err) {
    next(err);
  }
});

authRouter.get("/me", authenticate, async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, "Unauthenticated");
    const { displayName, memberships } = await authService.me(req.auth.accountId);
    const active = memberships.find((m) => m.schoolId === req.auth!.schoolId) ?? memberships[0];
    res.json({
      data: { accountId: req.auth.accountId, displayName, active, memberships },
    });
  } catch (err) {
    next(err);
  }
});
