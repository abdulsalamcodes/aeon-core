import { Router } from "express";
import {
  financeService,
  createFeeStructureInput,
  assignFeeInput,
  recordPaymentInput,
} from "./finance.service.js";

export const financeRouter: Router = Router();

financeRouter.get("/fee-structures", async (req, res, next) => {
  try {
    const termId = req.query.termId ? String(req.query.termId) : undefined;
    res.json({ data: await financeService.listStructures(termId) });
  } catch (err) {
    next(err);
  }
});

financeRouter.post("/fee-structures", async (req, res, next) => {
  try {
    const parsed = createFeeStructureInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    res.status(201).json({ data: await financeService.createFeeStructure(parsed.data) });
  } catch (err) {
    next(err);
  }
});

financeRouter.post("/assign", async (req, res, next) => {
  try {
    const parsed = assignFeeInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    res.status(201).json({ data: await financeService.assignFee(parsed.data) });
  } catch (err) {
    next(err);
  }
});

financeRouter.post("/payments", async (req, res, next) => {
  try {
    const parsed = recordPaymentInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    res.status(201).json({ data: await financeService.recordPayment(parsed.data) });
  } catch (err) {
    next(err);
  }
});

// Payment gateway webhook → normalized event → idempotent ledger credit.
financeRouter.post("/payments/webhook/:provider", async (req, res, next) => {
  try {
    const termId = String(req.body?.termId ?? "");
    if (!termId) {
      res.status(400).json({ error: "termId is required" });
      return;
    }
    const entry = await financeService.recordFromWebhook(req.params.provider, req.body, termId);
    res.json({ data: entry, recorded: Boolean(entry) });
  } catch (err) {
    next(err);
  }
});

financeRouter.patch("/fee-structures/:id", async (req, res, next) => {
  try {
    await financeService.updateStructure(req.params.id, req.body ?? {});
    res.json({ data: { id: req.params.id } });
  } catch (err) {
    next(err);
  }
});

financeRouter.post("/assign-class", async (req, res, next) => {
  try {
    const { classId, feeStructureId, termId } = req.body ?? {};
    if (!classId || !feeStructureId || !termId) {
      res.status(400).json({ error: "classId, feeStructureId, termId required" });
      return;
    }
    res.json({ data: await financeService.assignToClass({ classId, feeStructureId, termId }) });
  } catch (err) {
    next(err);
  }
});

financeRouter.get("/student-term", async (req, res, next) => {
  try {
    const studentId = String(req.query.studentId ?? "");
    const termId = String(req.query.termId ?? "");
    if (!studentId || !termId) {
      res.status(400).json({ error: "studentId and termId required" });
      return;
    }
    res.json({ data: await financeService.studentTerm(studentId, termId) });
  } catch (err) {
    next(err);
  }
});

financeRouter.get("/outstanding", async (req, res, next) => {
  try {
    const termId = String(req.query.termId ?? "");
    if (!termId) {
      res.status(400).json({ error: "termId required" });
      return;
    }
    res.json({ data: await financeService.outstanding(termId) });
  } catch (err) {
    next(err);
  }
});

financeRouter.get("/balance", async (req, res, next) => {
  try {
    const studentId = String(req.query.studentId ?? "");
    const termId = String(req.query.termId ?? "");
    if (!studentId || !termId) {
      res.status(400).json({ error: "studentId and termId are required" });
      return;
    }
    res.json({ data: await financeService.balanceFor(studentId, termId) });
  } catch (err) {
    next(err);
  }
});
