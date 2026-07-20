import { z } from "zod";

export const studentLoginInput = z.object({
  studentNumber: z.string().trim().min(1),
  dob: z.string().min(1),
  schoolSlug: z.string().min(1),
});
export type StudentLoginInput = z.infer<typeof studentLoginInput>;
