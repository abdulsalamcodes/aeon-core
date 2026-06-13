import { Router } from "express";
import { notificationService, sendInput } from "./notification.service.js";

export const notificationsRouter: Router = Router();

notificationsRouter.get("/", async (_req, res, next) => {
  try {
    res.json({ data: await notificationService.listRecent() });
  } catch (err) {
    next(err);
  }
});

notificationsRouter.post("/send", async (req, res, next) => {
  try {
    const parsed = sendInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    res.status(201).json({ data: await notificationService.send(parsed.data) });
  } catch (err) {
    next(err);
  }
});
