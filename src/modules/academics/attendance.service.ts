import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { attendance, type Attendance } from "../../db/schema/attendance.js";
import { currentTenant, withTenant } from "../../tenant/context.js";

export const markInput = z.object({
  attendanceId: z.string().uuid(),
  status: z.enum(["present", "absent", "late", "excused", "unmarked"]),
});
export type MarkInput = z.infer<typeof markInput>;

export const attendanceService = {
  /**
   * Seeds a register row for a student on a date (idempotent). Called by the
   * `StudentEnrolled` ripple so a newly enrolled student immediately appears on
   * the register — no module has to remember to do this.
   */
  async seedRegister(p: { studentId: string; classId: string; termId: string; date: string }): Promise<void> {
    const { schoolId } = currentTenant();
    await withTenant((tx) =>
      tx
        .insert(attendance)
        .values({ schoolId, studentId: p.studentId, classId: p.classId, termId: p.termId, date: p.date })
        .onConflictDoNothing(),
    );
  },

  async mark(input: MarkInput): Promise<Attendance> {
    return withTenant(async (tx) => {
      const [row] = await tx
        .update(attendance)
        .set({ status: input.status })
        .where(eq(attendance.id, input.attendanceId))
        .returning();
      if (!row) throw new Error("Attendance row not found");
      return row;
    });
  },

  /** Upsert a whole class register for a date (mark all present/absent/etc). */
  async bulkMark(p: { classId: string; termId: string; date: string; records: { studentId: string; status: MarkInput["status"] }[] }): Promise<number> {
    const { schoolId } = currentTenant();
    await withTenant(async (tx) => {
      for (const r of p.records) {
        await tx
          .insert(attendance)
          .values({ schoolId, studentId: r.studentId, classId: p.classId, termId: p.termId, date: p.date, status: r.status })
          .onConflictDoUpdate({
            target: [attendance.studentId, attendance.classId, attendance.date],
            set: { status: r.status },
          });
      }
    });
    return p.records.length;
  },

  async listForClassDate(classId: string, date: string): Promise<Attendance[]> {
    return withTenant((tx) =>
      tx
        .select()
        .from(attendance)
        .where(and(eq(attendance.classId, classId), eq(attendance.date, date))),
    );
  },
};
