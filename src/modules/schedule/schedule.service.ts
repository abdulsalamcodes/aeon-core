import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { calendarEvents, type CalendarEvent } from "../../db/schema/calendarEvents.js";
import { timetables, type Timetable, type TimetableDay } from "../../db/schema/timetables.js";
import { currentTenant, withTenant } from "../../tenant/context.js";

export const createEventInput = z.object({
  title: z.string().trim().min(1),
  description: z.string().optional(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  type: z.enum(["holiday", "exam", "event", "term-start", "term-end"]),
});

export const upsertTimetableInput = z.object({
  classId: z.string().uuid(),
  termId: z.string().uuid(),
  schedule: z.array(z.object({ day: z.string(), periods: z.array(z.any()) })),
});

export const calendarService = {
  async list(): Promise<CalendarEvent[]> {
    return withTenant((tx) => tx.select().from(calendarEvents));
  },
  async create(input: z.infer<typeof createEventInput>): Promise<CalendarEvent> {
    const { schoolId } = currentTenant();
    return withTenant(async (tx) => {
      const [row] = await tx.insert(calendarEvents).values({ schoolId, ...input }).returning();
      if (!row) throw new Error("Failed to create event");
      return row;
    });
  },
  async remove(id: string): Promise<void> {
    await withTenant((tx) => tx.delete(calendarEvents).where(eq(calendarEvents.id, id)));
  },
};

export const timetableService = {
  async getByClassTerm(classId: string, termId: string): Promise<Timetable | null> {
    const rows = await withTenant((tx) =>
      tx.select().from(timetables).where(and(eq(timetables.classId, classId), eq(timetables.termId, termId))).limit(1),
    );
    return rows[0] ?? null;
  },
  async upsert(input: z.infer<typeof upsertTimetableInput>): Promise<Timetable> {
    const { schoolId } = currentTenant();
    return withTenant(async (tx) => {
      const [row] = await tx
        .insert(timetables)
        .values({ schoolId, classId: input.classId, termId: input.termId, schedule: input.schedule as TimetableDay[] })
        .onConflictDoUpdate({ target: [timetables.classId, timetables.termId], set: { schedule: input.schedule as TimetableDay[] } })
        .returning();
      if (!row) throw new Error("Failed to save timetable");
      return row;
    });
  },
};
