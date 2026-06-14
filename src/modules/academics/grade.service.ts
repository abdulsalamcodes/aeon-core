import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { grades, type Grade } from "../../db/schema/grades.js";
import { enrollments } from "../../db/schema/enrollments.js";
import { persons } from "../../db/schema/persons.js";
import { subjects } from "../../db/schema/subjects.js";
import { currentTenant, withTenant } from "../../tenant/context.js";

export const recordGradeInput = z.object({
  studentId: z.string().uuid(),
  subjectId: z.string().uuid(),
  termId: z.string().uuid(),
  caScore: z.number().int().min(0).max(100),
  examScore: z.number().int().min(0).max(100),
});
export type RecordGradeInput = z.infer<typeof recordGradeInput>;

export const gradeService = {
  /** Upserts a student's score for a subject in a term (one row per triple). */
  async record(input: RecordGradeInput): Promise<Grade> {
    const { schoolId } = currentTenant();
    return withTenant(async (tx) => {
      const [row] = await tx
        .insert(grades)
        .values({
          schoolId,
          studentId: input.studentId,
          subjectId: input.subjectId,
          termId: input.termId,
          caScore: input.caScore,
          examScore: input.examScore,
        })
        .onConflictDoUpdate({
          target: [grades.studentId, grades.subjectId, grades.termId],
          set: { caScore: input.caScore, examScore: input.examScore },
        })
        .returning();
      if (!row) throw new Error("Failed to record grade");
      return row;
    });
  },

  async listForStudentTerm(studentId: string, termId: string): Promise<Grade[]> {
    return withTenant((tx) =>
      tx
        .select()
        .from(grades)
        .where(and(eq(grades.studentId, studentId), eq(grades.termId, termId))),
    );
  },

  /** Class grade sheet: every student enrolled in the class for the term, with
   *  their grade rows (left join — students with no grade yet show up too). */
  async classSheet(classId: string, termId: string) {
    return withTenant((tx) =>
      tx
        .select({
          studentId: persons.id,
          firstName: persons.firstName,
          lastName: persons.lastName,
          gradeId: grades.id,
          subjectId: grades.subjectId,
          subjectName: subjects.name,
          caScore: grades.caScore,
          examScore: grades.examScore,
        })
        .from(enrollments)
        .innerJoin(persons, eq(persons.id, enrollments.studentId))
        .leftJoin(grades, and(eq(grades.studentId, persons.id), eq(grades.termId, termId)))
        .leftJoin(subjects, eq(subjects.id, grades.subjectId))
        .where(and(eq(enrollments.classId, classId), eq(enrollments.termId, termId))),
    );
  },
};
