import { z } from "zod";

export const adminLoginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type AdminLoginInput = z.infer<typeof adminLoginInput>;

export const createInstitutionInput = z.object({
  schoolName: z.string().trim().min(1),
  name: z.string().trim().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});
export type CreateInstitutionInput = z.infer<typeof createInstitutionInput>;

export const createAdminInput = z.object({
  name: z.string().trim().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});
export type CreateAdminInput = z.infer<typeof createAdminInput>;

export const updateAdminInput = z.object({
  status: z.enum(["active", "disabled"]).optional(),
});
export type UpdateAdminInput = z.infer<typeof updateAdminInput>;
