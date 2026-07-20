import { z } from "zod";

export const createEventInput = z.object({
  title: z.string().trim().min(1),
  description: z.string().optional(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  type: z.enum(["holiday", "exam", "event", "term-start", "term-end"]),
});
export type CreateEventInput = z.infer<typeof createEventInput>;

export const upsertTimetableInput = z.object({
  classId: z.string().uuid(),
  termId: z.string().uuid(),
  schedule: z.array(z.object({ day: z.string(), periods: z.array(z.any()) })),
});
export type UpsertTimetableInput = z.infer<typeof upsertTimetableInput>;

/** GET timetable?classId=&termId= */
export const timetableQuery = z.object({ classId: z.string().uuid(), termId: z.string().uuid() });
