import { Router } from "express";
import { schoolService } from "./school.service.js";
import { billingService, isPaidPlan } from "./billing.service.js";

/** Public org/school lookups — no auth (used by login pages). */
export const publicOrgRouter: Router = Router();

publicOrgRouter.get("/schools/:slug", async (req, res, next) => {
  try {
    const school = await schoolService.bySlug(req.params.slug);
    if (!school) {
      res.status(404).json({ error: "School not found" });
      return;
    }
    res.json({ data: school });
  } catch (err) {
    next(err);
  }
});

/** Authenticated school management — requires auth + tenant middleware from app.ts. */
export const orgRouter: Router = Router();

orgRouter.get("/school", async (req, res, next) => {
  try {
    const school = await schoolService.byId(req.auth!.schoolId);
    if (!school) { res.status(404).json({ error: "School not found" }); return; }
    res.json({ data: school });
  } catch (err) {
    next(err);
  }
});

orgRouter.post("/billing/checkout", async (req, res, next) => {
  try {
    const plan = String((req.body as Record<string, unknown> | undefined)?.plan ?? "");
    if (!isPaidPlan(plan)) {
      res.status(422).json({ error: `'${plan}' is not a purchasable plan` });
      return;
    }
    res.status(201).json({ data: await billingService.startPlanCheckout(req.auth!.schoolId, plan) });
  } catch (err) {
    next(err);
  }
});

orgRouter.get("/school/settings", async (req, res, next) => {
  try {
    res.json({ data: await schoolService.getSettings(req.auth!.schoolId) });
  } catch (err) {
    next(err);
  }
});

orgRouter.patch("/school/settings", async (req, res, next) => {
  try {
    const patch = req.body as unknown;
    if (typeof patch !== "object" || patch === null || Array.isArray(patch)) {
      res.status(422).json({ error: "Settings patch must be a JSON object" });
      return;
    }
    res.json({ data: await schoolService.updateSettings(req.auth!.schoolId, patch as Record<string, unknown>) });
  } catch (err) {
    next(err);
  }
});

orgRouter.patch("/school", async (req, res, next) => {
  try {
    const { name, email, phone, address } = req.body as Record<string, string>;
    await schoolService.update(req.auth!.schoolId, { name, email, phone, address });
    const updated = await schoolService.byId(req.auth!.schoolId);
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});
