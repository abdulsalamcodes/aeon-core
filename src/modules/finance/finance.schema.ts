import { z } from "zod";

const ISO_CCY = z.string().length(3).toUpperCase();

export const createFeeStructureInput = z.object({
  termId: z.string().uuid(),
  name: z.string().trim().min(1),
  amountMinor: z.number().int().positive(),
  currency: ISO_CCY,
  isDefault: z.boolean().optional(),
});
export type CreateFeeStructureInput = z.infer<typeof createFeeStructureInput>;

export const assignFeeInput = z.object({
  studentId: z.string().uuid(),
  feeStructureId: z.string().uuid(),
});
export type AssignFeeInput = z.infer<typeof assignFeeInput>;

export const initiatePaymentInput = z.object({
  studentId: z.string().uuid(),
  termId: z.string().uuid(),
  amountMinor: z.number().int().positive(),
  currency: ISO_CCY,
  email: z.string().email(),
});
export type InitiatePaymentInput = z.infer<typeof initiatePaymentInput>;

export const recordPaymentInput = z.object({
  studentId: z.string().uuid(),
  termId: z.string().uuid(),
  amountMinor: z.number().int().positive(),
  currency: ISO_CCY,
  idempotencyKey: z.string().min(8),
  method: z.enum(["cash", "transfer", "card", "mobile-money"]).default("cash"),
  reference: z.string().optional(),
});
export type RecordPaymentInput = z.infer<typeof recordPaymentInput>;

export const assignClassInput = z.object({
  classId: z.string().uuid(),
  feeStructureId: z.string().uuid(),
  termId: z.string().uuid(),
});
export type AssignClassInput = z.infer<typeof assignClassInput>;

export const termIdQuery = z.object({ termId: z.string().uuid() });
export const studentTermQuery = z.object({ studentId: z.string().uuid(), termId: z.string().uuid() });

export const webhookTermId = z.object({ termId: z.string().uuid() });
