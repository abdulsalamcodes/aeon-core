import { z } from "zod";

export const presignInput = z.object({
  contentType: z.string().min(1),
});

export const photoUploadInput = z.object({
  dataUrl: z.string().startsWith("data:"),
});
