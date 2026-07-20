import { z } from "zod";

export const loginInput = z
  .object({
    email: z.string().email(),
    password: z.string().min(1),
    schoolId: z.string().uuid().optional(),
    schoolSlug: z.string().optional(),
  })
  .strip();
export type LoginInput = z.infer<typeof loginInput>;

const FREE_PLAN = "starter";
const SIGNUP_PLANS = [FREE_PLAN, "growth"] as const;

export const signupInput = z.object({
  schoolName: z.string().trim().min(2),
  adminName: z.string().trim().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  plan: z.enum(SIGNUP_PLANS),
});
export type SignupInput = z.infer<typeof signupInput>;

export const refreshTokenInput = z.object({
  refreshToken: z.string().min(1),
  schoolSlug: z.string().optional(),
});

export const verifyEmailInput = z.object({
  token: z.string().min(1),
});
