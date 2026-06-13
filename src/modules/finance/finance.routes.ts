import { Router } from "express";
import {
  financeService,
  createFeeStructureInput,
  assignFeeInput,
  recordPaymentInput,
} from "./finance.service.js";

export const financeRouter: Router = Router();

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
