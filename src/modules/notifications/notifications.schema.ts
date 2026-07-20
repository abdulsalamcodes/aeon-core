import { z } from "zod";

export const sendInput = z.object({
  channel: z.enum(["sms", "whatsapp", "email"]),
  to: z.string().min(3),
  template: z.string().min(1),
  body: z.string().min(1),
});
export type SendInput = z.infer<typeof sendInput>;
