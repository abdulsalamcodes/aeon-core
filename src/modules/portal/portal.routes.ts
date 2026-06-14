import { Router } from "express";
import { HttpError } from "../../lib/http-error.js";
import { portalService, studentLoginInput } from "./portal.service.js";

/** Public student login (admission number + DOB). */
export const portalAuthRouter: Router = Router();
portalAuthRouter.post("/student-login", async (req, res, next) => {
  try {
    const parsed = studentLoginInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    res.json({ data: await portalService.login(parsed.data) });
  } catch (err) {
    next(err);
  }
});

/** Student-scoped reads. Requires a student token; all data is the caller's own. */
export const portalRouter: Router = Router();
portalRouter.use((req, res, next) => {
  if (req.auth?.role !== "student" || !req.auth.studentId) {
    next(new HttpError(403, "Student access only"));
    return;
  }
  next();
});

portalRouter.get("/me", async (req, res, next) => {
  try {
    res.json({ data: await portalService.me(req.auth!.schoolId, req.auth!.orgId, req.auth!.studentId!) });
  } catch (err) {
    next(err);
  }
});
portalRouter.get("/grades", async (req, res, next) => {
  try {
    res.json({ data: await portalService.grades(req.auth!.studentId!) });
  } catch (err) {
    next(err);
  }
});
portalRouter.get("/attendance", async (req, res, next) => {
  try {
    res.json({ data: await portalService.attendance(req.auth!.studentId!) });
  } catch (err) {
    next(err);
  }
});
portalRouter.get("/fees", async (req, res, next) => {
  try {
    res.json({ data: await portalService.fees(req.auth!.studentId!) });
  } catch (err) {
    next(err);
  }
});
