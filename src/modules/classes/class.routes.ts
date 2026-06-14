import { Router } from "express";
import { classService, createClassInput } from "./class.service.js";

export const classRouter: Router = Router();

classRouter.get("/", async (_req, res, next) => {
  try {
    res.json({ data: await classService.list() });
  } catch (err) {
    next(err);
  }
});

classRouter.post("/", async (req, res, next) => {
  try {
    const parsed = createClassInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    res.status(201).json({ data: await classService.create(parsed.data) });
  } catch (err) {
    next(err);
  }
});

classRouter.patch("/:id", async (req, res, next) => {
  try {
    await classService.update(req.params.id, req.body ?? {});
    res.json({ data: { id: req.params.id } });
  } catch (err) {
    next(err);
  }
});

classRouter.delete("/:id", async (req, res, next) => {
  try {
    await classService.remove(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
