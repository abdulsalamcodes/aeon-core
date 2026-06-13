import { Router } from "express";
import { schoolService } from "./school.service.js";

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
