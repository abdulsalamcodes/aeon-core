import { Router } from "express";
import { workflowService, defineInput, startInput, decideInput } from "./workflow.service.js";

export const workflowRouter: Router = Router();

workflowRouter.post("/definitions", async (req, res, next) => {
  try {
    const parsed = defineInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    await workflowService.define(parsed.data);
    res.status(201).json({ data: { key: parsed.data.key } });
  } catch (err) {
    next(err);
  }
});

workflowRouter.post("/start", async (req, res, next) => {
  try {
    const parsed = startInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    res.status(201).json({ data: await workflowService.start(parsed.data) });
  } catch (err) {
    next(err);
  }
});

workflowRouter.post("/decide", async (req, res, next) => {
  try {
    const parsed = decideInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    res.json({ data: await workflowService.decide(parsed.data) });
  } catch (err) {
    next(err);
  }
});
