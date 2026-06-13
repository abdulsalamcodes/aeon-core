import { Router } from "express";
import { enrollmentService, enrollInput } from "./enrollment.service.js";
import { guardianshipService, linkGuardianInput } from "./guardianship.service.js";
import { studentService, createStudentInput } from "./student.service.js";
import { staffService } from "./staff.service.js";

export const peopleRouter: Router = Router();

peopleRouter.get("/students", async (_req, res, next) => {
  try {
    res.json({ data: await studentService.list() });
  } catch (err) {
    next(err);
  }
});

peopleRouter.post("/students", async (req, res, next) => {
  try {
    const parsed = createStudentInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    res.status(201).json({ data: await studentService.create(parsed.data) });
  } catch (err) {
    next(err);
  }
});

peopleRouter.get("/staff", async (_req, res, next) => {
  try {
    res.json({ data: await staffService.list() });
  } catch (err) {
    next(err);
  }
});

peopleRouter.get("/enrollments", async (_req, res, next) => {
  try {
    res.json({ data: await enrollmentService.list() });
  } catch (err) {
    next(err);
  }
});

peopleRouter.post("/enrollments", async (req, res, next) => {
  try {
    const parsed = enrollInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    res.status(201).json({ data: await enrollmentService.enroll(parsed.data) });
  } catch (err) {
    next(err);
  }
});

peopleRouter.post("/guardianships", async (req, res, next) => {
  try {
    const parsed = linkGuardianInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    res.status(201).json({ data: await guardianshipService.link(parsed.data) });
  } catch (err) {
    next(err);
  }
});
