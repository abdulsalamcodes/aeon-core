import { Router } from "express";
import { decodeDataUrl, storageProvider } from "../../storage/index.js";

const PHOTO_PREFIX = "photos";

/**
 * File uploads. The client sends a data URL; we store it via the active object
 * storage provider (R2 in production, an inline fallback in dev) and return the
 * retrievable URL. Callers are storage-agnostic (ADR-12).
 */
export const uploadsRouter: Router = Router();

uploadsRouter.post("/photo", async (req, res, next) => {
  try {
    const dataUrl = String(req.body?.dataUrl ?? "");
    if (!dataUrl.startsWith("data:")) {
      res.status(400).json({ error: "dataUrl is required" });
      return;
    }
    const url = await storageProvider().putImage(decodeDataUrl(dataUrl), PHOTO_PREFIX);
    res.status(201).json({ data: { url } });
  } catch (err) {
    next(err);
  }
});
