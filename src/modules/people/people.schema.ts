import { z } from "zod";

export const enrollInput = z.object({
  studentId: z.string().uuid(),
  classId: z.string().uuid(),
  termId: z.string().uuid(),
});
export type EnrollInput = z.infer<typeof enrollInput>;

export const createStaffInput = z.object({
  name: z.string().trim().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.string().default("teacher"),
});
export type CreateStaffInput = z.infer<typeof createStaffInput>;

export const promoteInput = z.object({
  fromClassId: z.string().uuid(),
  toClassId: z.string().uuid(),
  termId: z.string().uuid().optional(),
  studentIds: z.array(z.string().uuid()).optional(),
  promoteAll: z.boolean().optional(),
});
export type PromoteInput = z.infer<typeof promoteInput>;

export const linkGuardianInput = z.object({
  guardianId: z.string().uuid(),
  studentId: z.string().uuid(),
  relationship: z.string().trim().max(60).optional(),
});
export type LinkGuardianInput = z.infer<typeof linkGuardianInput>;

export const createStudentInput = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  studentNumber: z.string().trim().optional(),
  gender: z.enum(["male", "female"]).optional(),
  dob: z.string().optional(),
  guardianName: z.string().trim().optional(),
  guardianPhone: z.string().trim().optional(),
  guardianEmail: z.string().trim().optional(),
  classId: z.string().uuid().optional(),
  termId: z.string().uuid().optional(),
});
export type CreateStudentInput = z.infer<typeof createStudentInput>;

export const csvImportInput = z.object({ csv: z.string().min(1) });
