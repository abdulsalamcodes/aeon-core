import { z } from "zod";

export const createSubjectInput = z.object({
  name: z.string().trim().min(1).max(120),
});
export type CreateSubjectInput = z.infer<typeof createSubjectInput>;
