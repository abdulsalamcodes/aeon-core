import { Router } from "express";
import { decodeDataUrl, isSupportedImageType, storageProvider } from "../../storage/index.js";

const PHOTO_PREFIX = "photos";

/**
 * Photo uploads. Preferred path: the client asks `/photo/presign` for a direct
 * browser → R2 target, so bytes never pass through the API. The `/photo`
 * data-URL path is the fallback for environments with no object storage (dev),
 * where direct upload isn't possible. Callers are storage-agnostic (ADR-12).
 */
export const uploadsRouter: Router = Router();

uploadsRouter.post("/photo/presign", async (req, res, next) => {
  try {
    const contentType = String(req.body?.contentType ?? "");
    if (!isSupportedImageType(contentType)) {
      res.status(422).json({ error: "Unsupported image type" });
      return;
    }
    const provider = storageProvider();
    if (!provider.supportsDirectUpload) {
      res.json({ data: { strategy: "inline" } });
      return;
    }
    const target = await provider.createImageUploadTarget({ contentType, prefix: PHOTO_PREFIX });
    res.status(201).json({ data: { strategy: "direct", ...target } });
  } catch (err) {
    next(err);
  }
});

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
