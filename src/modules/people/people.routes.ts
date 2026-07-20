import { Router } from "express";
import { enrollmentService } from "./enrollment.service.js";
import { guardianshipService } from "./guardianship.service.js";
import { studentService } from "./student.service.js";
import { staffService } from "./staff.service.js";
import { promotionService } from "./promotion.service.js";
import { enrollInput, linkGuardianInput, createStudentInput, createStaffInput, promoteInput, csvImportInput } from "./people.schema.js";

export const peopleRouter: Router = Router();

const CSV_TEMPLATE = "firstname,lastname,studentNumber,gender,dob,guardianName,guardianPhone,guardianEmail\n";

// Specific student sub-routes MUST precede "/students/:id".
peopleRouter.get("/students/import/template", (_req, res) => {
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="students-template.csv"');
  res.send(CSV_TEMPLATE);
});

peopleRouter.post("/students/import", async (req, res, next) => {
  try {
    const parsed = csvImportInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    res.json({ data: await studentService.bulkImport(parsed.data.csv) });
  } catch (err) {
    next(err);
  }
});

peopleRouter.get("/students/export", async (_req, res, next) => {
  try {
    const csv = await promotionService.exportCsv();
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="students.csv"');
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

peopleRouter.post("/promote", async (req, res, next) => {
  try {
    const parsed = promoteInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    res.json({ data: await promotionService.promote(parsed.data) });
  } catch (err) {
    next(err);
  }
});

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

peopleRouter.get("/students/:id", async (req, res, next) => {
  try {
    const student = await studentService.get(req.params.id);
    if (!student) {
      res.status(404).json({ error: "Student not found" });
      return;
    }
    res.json({ data: student });
  } catch (err) {
    next(err);
  }
});

peopleRouter.patch("/students/:id", async (req, res, next) => {
  try {
    await studentService.update(req.params.id, req.body ?? {});
    res.json({ data: await studentService.get(req.params.id) });
  } catch (err) {
    next(err);
  }
});

peopleRouter.delete("/students/:id", async (req, res, next) => {
  try {
    await studentService.remove(req.params.id);
    res.status(204).end();
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

peopleRouter.post("/staff", async (req, res, next) => {
  try {
    const parsed = createStaffInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    res.status(201).json({ data: await staffService.create(parsed.data) });
  } catch (err) {
    next(err);
  }
});

peopleRouter.delete("/staff/:id", async (req, res, next) => {
  try {
    await staffService.remove(req.params.id);
    res.status(204).end();
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
