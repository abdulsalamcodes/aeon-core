import { Router } from "express";
import { financeService } from "./finance.service.js";
import {
  createFeeStructureInput,
  assignFeeInput,
  recordPaymentInput,
  initiatePaymentInput,
  assignClassInput,
  studentTermQuery,
  termIdQuery,
  webhookTermId,
} from "./finance.schema.js";

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
      res
        .status(422)
        .json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    res
      .status(201)
      .json({ data: await financeService.createFeeStructure(parsed.data) });
  } catch (err) {
    next(err);
  }
});

financeRouter.post("/assign", async (req, res, next) => {
  try {
    const parsed = assignFeeInput.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(422)
        .json({ error: "Validation failed", details: parsed.error.flatten() });
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
      res
        .status(422)
        .json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    res
      .status(201)
      .json({ data: await financeService.recordPayment(parsed.data) });
  } catch (err) {
    next(err);
  }
});

// Hosted checkout: returns a gateway redirect URL for a fee payment.
financeRouter.post("/payments/initiate", async (req, res, next) => {
  try {
    const parsed = initiatePaymentInput.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(422)
        .json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    res
      .status(201)
      .json({ data: await financeService.initiateOnlinePayment(parsed.data) });
  } catch (err) {
    next(err);
  }
});

// Payment gateway webhook → normalized event → idempotent ledger credit.
financeRouter.post("/payments/webhook/:provider", async (req, res, next) => {
  try {
    const parsed = webhookTermId.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    const entry = await financeService.recordFromWebhook(
      req.params.provider,
      req.body,
      parsed.data.termId,
    );
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
    const parsed = assignClassInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    res.json({
      data: await financeService.assignToClass(parsed.data),
    });
  } catch (err) {
    next(err);
  }
});

financeRouter.get("/student-term", async (req, res, next) => {
  try {
    const parsed = studentTermQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    res.json({ data: await financeService.studentTerm(parsed.data.studentId, parsed.data.termId) });
  } catch (err) {
    next(err);
  }
});

financeRouter.get("/outstanding", async (req, res, next) => {
  try {
    const parsed = termIdQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    res.json({ data: await financeService.outstanding(parsed.data.termId) });
  } catch (err) {
    next(err);
  }
});

financeRouter.get("/balance", async (req, res, next) => {
  try {
    const parsed = studentTermQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    res.json({ data: await financeService.balanceFor(parsed.data.studentId, parsed.data.termId) });
  } catch (err) {
    next(err);
  }
});
