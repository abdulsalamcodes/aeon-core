import { Router } from "express";

/**
 * File uploads. The client sends a data URL; we return a stored URL.
 *
 * In the current build the data URL is echoed back (so photos render with no
 * external storage). The production integration point is here: when R2/S3 is
 * configured, decode the data URL, upload, and return the public URL instead —
 * callers don't change.
 */
export const uploadsRouter: Router = Router();

uploadsRouter.post("/photo", async (req, res, next) => {
  try {
    const dataUrl = String(req.body?.dataUrl ?? "");
    if (!dataUrl.startsWith("data:")) {
      res.status(400).json({ error: "dataUrl is required" });
      return;
    }
    // TODO(prod): if R2 configured → upload(decode(dataUrl)) → return public URL.
    res.status(201).json({ data: { url: dataUrl } });
  } catch (err) {
    next(err);
  }
});
