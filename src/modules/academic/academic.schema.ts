import { z } from "zod";

export const createTermInput = z.object({
  name: z.string().trim().min(1),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  isCurrent: z.boolean().optional(),
});
export type CreateTermInput = z.infer<typeof createTermInput>;
