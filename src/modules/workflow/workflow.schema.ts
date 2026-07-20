import { z } from "zod";

export const defineInput = z.object({
  key: z.string().min(1),
  steps: z.array(z.object({ name: z.string().min(1), approverRole: z.string().min(1) })).min(1),
});
export type DefineInput = z.infer<typeof defineInput>;

export const startInput = z.object({
  key: z.string().min(1),
  subjectRef: z.string().min(1),
});
export type StartInput = z.infer<typeof startInput>;

export const decideInput = z.object({
  taskId: z.string().uuid(),
  decision: z.enum(["approve", "reject"]),
  deciderId: z.string().uuid().optional(),
});
export type DecideInput = z.infer<typeof decideInput>;
