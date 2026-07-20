import { Router } from "express";
import { z } from "zod";
import { workflowService } from "./workflow.service.js";
import { defineInput, startInput, decideInput } from "./workflow.schema.js";

const taskStatusQuery = z.enum(["pending", "approved", "rejected"]).optional();

export const workflowRouter: Router = Router();

workflowRouter.get("/definitions", async (_req, res, next) => {
  try {
    res.json({ data: await workflowService.listDefinitions() });
  } catch (err) {
    next(err);
  }
});

workflowRouter.get("/tasks", async (req, res, next) => {
  try {
    const parsed = taskStatusQuery.safeParse(req.query.status || undefined);
    if (!parsed.success) {
      res.status(422).json({ error: "status must be pending, approved, or rejected" });
      return;
    }
    res.json({ data: await workflowService.listTasks(parsed.data) });
  } catch (err) {
    next(err);
  }
});

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
