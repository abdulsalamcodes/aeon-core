import { Router } from "express";
import { createSubjectInput, subjectService } from "./subject.service.js";

/**
 * HTTP surface for Subjects. Thin — validates input, delegates to the service.
 * Tenant context is already established by `tenantResolver` upstream.
 */
export const subjectRouter: Router = Router();

subjectRouter.get("/", async (_req, res, next) => {
  try {
    res.json({ data: await subjectService.list() });
  } catch (err) {
    next(err);
  }
});

subjectRouter.post("/", async (req, res, next) => {
  try {
    const parsed = createSubjectInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    const subject = await subjectService.create(parsed.data);
    res.status(201).json({ data: subject });
  } catch (err) {
    next(err);
  }
});
