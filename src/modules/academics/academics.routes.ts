import { Router } from "express";
import { attendanceService, markInput } from "./attendance.service.js";
import { gradeService, recordGradeInput } from "./grade.service.js";

export const academicsRouter: Router = Router();

academicsRouter.get("/attendance", async (req, res, next) => {
  try {
    const classId = String(req.query.classId ?? "");
    const date = String(req.query.date ?? "");
    if (!classId || !date) {
      res.status(400).json({ error: "classId and date are required" });
      return;
    }
    res.json({ data: await attendanceService.listForClassDate(classId, date) });
  } catch (err) {
    next(err);
  }
});

academicsRouter.post("/attendance/bulk", async (req, res, next) => {
  try {
    const { classId, termId, date, records } = req.body ?? {};
    if (!classId || !termId || !date || !Array.isArray(records)) {
      res.status(400).json({ error: "classId, termId, date, records required" });
      return;
    }
    res.json({ data: { count: await attendanceService.bulkMark({ classId, termId, date, records }) } });
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
    const classId = String(req.query.classId ?? "");
    const termId = String(req.query.termId ?? "");
    if (!classId || !termId) {
      res.status(400).json({ error: "classId and termId required" });
      return;
    }
    res.json({ data: await gradeService.classSheet(classId, termId) });
  } catch (err) {
    next(err);
  }
});

academicsRouter.get("/grades", async (req, res, next) => {
  try {
    const studentId = String(req.query.studentId ?? "");
    const termId = String(req.query.termId ?? "");
    if (!studentId || !termId) {
      res.status(400).json({ error: "studentId and termId are required" });
      return;
    }
    res.json({ data: await gradeService.listForStudentTerm(studentId, termId) });
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
