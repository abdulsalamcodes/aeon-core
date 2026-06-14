import { Router } from "express";
import { calendarService, timetableService, createEventInput, upsertTimetableInput } from "./schedule.service.js";

export const calendarRouter: Router = Router();
calendarRouter.get("/", async (_req, res, next) => {
  try {
    res.json({ data: await calendarService.list() });
  } catch (err) {
    next(err);
  }
});
calendarRouter.post("/", async (req, res, next) => {
  try {
    const parsed = createEventInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    res.status(201).json({ data: await calendarService.create(parsed.data) });
  } catch (err) {
    next(err);
  }
});
calendarRouter.delete("/:id", async (req, res, next) => {
  try {
    await calendarService.remove(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export const timetableRouter: Router = Router();
timetableRouter.get("/", async (req, res, next) => {
  try {
    const classId = String(req.query.classId ?? "");
    const termId = String(req.query.termId ?? "");
    if (!classId || !termId) {
      res.status(400).json({ error: "classId and termId required" });
      return;
    }
    res.json({ data: await timetableService.getByClassTerm(classId, termId) });
  } catch (err) {
    next(err);
  }
});
timetableRouter.post("/", async (req, res, next) => {
  try {
    const parsed = upsertTimetableInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    res.json({ data: await timetableService.upsert(parsed.data) });
  } catch (err) {
    next(err);
  }
});
