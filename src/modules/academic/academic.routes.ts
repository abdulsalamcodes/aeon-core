import { Router } from "express";
import { termService } from "./term.service.js";
import { createTermInput } from "./academic.schema.js";

/** Academic structure: terms (and sessions, mapped to terms in Phase 2). */
export const academicRouter: Router = Router();

academicRouter.get("/terms", async (_req, res, next) => {
  try {
    res.json({ data: await termService.list() });
  } catch (err) {
    next(err);
  }
});

academicRouter.get("/terms/current", async (_req, res, next) => {
  try {
    res.json({ data: await termService.current() });
  } catch (err) {
    next(err);
  }
});

academicRouter.post("/terms", async (req, res, next) => {
  try {
    const parsed = createTermInput.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(422)
        .json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    res.status(201).json({ data: await termService.create(parsed.data) });
  } catch (err) {
    next(err);
  }
});

academicRouter.patch("/terms/:id", async (req, res, next) => {
  try {
    await termService.update(req.params.id, req.body ?? {});
    res.json({ data: { id: req.params.id } });
  } catch (err) {
    next(err);
  }
});

academicRouter.post("/terms/:id/set-current", async (req, res, next) => {
  try {
    res.json({ data: await termService.setCurrent(req.params.id) });
  } catch (err) {
    next(err);
  }
});
