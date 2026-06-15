import { Router } from "express";
import { authenticate } from "../../auth/middleware.js";
import { HttpError } from "../../lib/http-error.js";
import { adminService, adminLoginInput, createInstitutionInput, createAdminInput, updateAdminInput } from "./admin.service.js";

/** Public super-admin login. */
export const adminAuthRouter: Router = Router();
adminAuthRouter.post("/login", async (req, res, next) => {
  try {
    const parsed = adminLoginInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    res.json({ data: await adminService.login(parsed.data) });
  } catch (err) {
    next(err);
  }
});

/**
 * Super-admin area. Authenticated but NOT tenant-bound — it spans all
 * institutions, so it is mounted outside the tenantResolver block.
 */
export const adminRouter: Router = Router();
adminRouter.use(authenticate, (req, res, next) => {
  if (req.auth?.role !== "super-admin") {
    next(new HttpError(403, "Super-admin only"));
    return;
  }
  next();
});

adminRouter.get("/dashboard", async (_req, res, next) => {
  try {
    res.json({ data: await adminService.dashboard() });
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/institutions", async (_req, res, next) => {
  try {
    res.json({ data: await adminService.listInstitutions() });
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/institutions", async (req, res, next) => {
  try {
    const parsed = createInstitutionInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    res.status(201).json({ data: await adminService.createInstitution(parsed.data) });
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/admins", async (_req, res, next) => {
  try {
    res.json({ data: await adminService.listAdmins() });
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/admins", async (req, res, next) => {
  try {
    const parsed = createAdminInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    res.status(201).json({ data: await adminService.createAdmin(parsed.data) });
  } catch (err) {
    next(err);
  }
});

adminRouter.patch("/admins/:id", async (req, res, next) => {
  try {
    const parsed = updateAdminInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    res.json({ data: await adminService.updateAdmin(req.params.id, parsed.data) });
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/institutions/:id", async (req, res, next) => {
  try {
    res.json({ data: await adminService.getInstitutionDetail(req.params.id) });
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/health", async (_req, res, next) => {
  try {
    res.json({ data: await adminService.health() });
  } catch (err) {
    next(err);
  }
});
