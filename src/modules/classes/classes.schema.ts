import { z } from "zod";

export const createClassInput = z.object({
  name: z.string().trim().min(1),
  classTeacherId: z.string().uuid().optional(),
});
export type CreateClassInput = z.infer<typeof createClassInput>;
