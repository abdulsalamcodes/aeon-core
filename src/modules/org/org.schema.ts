import { z } from "zod";

export const checkoutPlanInput = z.object({
  plan: z.string().min(1),
});
