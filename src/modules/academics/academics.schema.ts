import { z } from "zod";

export const markInput = z.object({
  attendanceId: z.string().uuid(),
  status: z.enum(["present", "absent", "late", "excused", "unmarked"]),
});
export type MarkInput = z.infer<typeof markInput>;

export const recordGradeInput = z.object({
  studentId: z.string().uuid(),
  subjectId: z.string().uuid(),
  termId: z.string().uuid(),
  caScore: z.number().int().min(0).max(100),
  examScore: z.number().int().min(0).max(100),
});
export type RecordGradeInput = z.infer<typeof recordGradeInput>;

/** GET /attendance?classId=&date= */
export const registerQuery = z.object({
  classId: z.string().uuid(),
  date: z.string().min(1),
});

export const bulkMarkInput = z.object({
  classId: z.string().uuid(),
  termId: z.string().uuid(),
  date: z.string().min(1),
  records: z.array(
    z.object({
      studentId: z.string().uuid(),
      status: z.enum(["present", "absent", "late", "excused", "unmarked"]),
    }),
  ),
});

/** GET /grades/class?classId=&termId= */
export const gradeClassQuery = z.object({
  classId: z.string().uuid(),
  termId: z.string().uuid(),
});

/** GET /grades?studentId=&termId= */
export const gradeStudentQuery = z.object({
  studentId: z.string().uuid(),
  termId: z.string().uuid(),
});
