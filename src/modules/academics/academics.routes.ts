import { Router } from "express";
import { attendanceService } from "./attendance.service.js";
import { gradeService } from "./grade.service.js";
import { markInput, recordGradeInput, registerQuery, gradeClassQuery, gradeStudentQuery, bulkMarkInput } from "./academics.schema.js";

export const academicsRouter: Router = Router();

academicsRouter.get("/attendance", async (req, res, next) => {
  try {
    const parsed = registerQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    res.json({ data: await attendanceService.listForClassDate(parsed.data.classId, parsed.data.date) });
  } catch (err) {
    next(err);
  }
});

academicsRouter.post("/attendance/bulk", async (req, res, next) => {
  try {
    const parsed = bulkMarkInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    res.json({ data: { count: await attendanceService.bulkMark(parsed.data) } });
  } catch (err) {
    next(err);
  }
});

academicsRouter.post("/attendance/mark", async (req, res, next) => {
  try {
    const parsed = markInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    res.json({ data: await attendanceService.mark(parsed.data) });
  } catch (err) {
    next(err);
  }
});

academicsRouter.get("/grades/class", async (req, res, next) => {
  try {
    const parsed = gradeClassQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    res.json({ data: await gradeService.classSheet(parsed.data.classId, parsed.data.termId) });
  } catch (err) {
    next(err);
  }
});

academicsRouter.get("/grades", async (req, res, next) => {
  try {
    const parsed = gradeStudentQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    res.json({ data: await gradeService.listForStudentTerm(parsed.data.studentId, parsed.data.termId) });
  } catch (err) {
    next(err);
  }
});

academicsRouter.post("/grades", async (req, res, next) => {
  try {
    const parsed = recordGradeInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    res.status(201).json({ data: await gradeService.record(parsed.data) });
  } catch (err) {
    next(err);
  }
});
