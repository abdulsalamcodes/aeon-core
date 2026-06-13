import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { persons, studentProfiles } from "../../db/schema/index.js";
import { currentTenant, withTenant } from "../../tenant/context.js";
import { enrollmentService } from "./enrollment.service.js";

export const createStudentInput = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  studentNumber: z.string().trim().optional(),
  gender: z.enum(["male", "female"]).optional(),
  dob: z.string().optional(),
  guardianName: z.string().trim().optional(),
  guardianPhone: z.string().trim().optional(),
  guardianEmail: z.string().trim().optional(),
  // Optional immediate enrolment → fires the StudentEnrolled ripple.
  classId: z.string().uuid().optional(),
  termId: z.string().uuid().optional(),
});
export type CreateStudentInput = z.infer<typeof createStudentInput>;

export interface StudentRow {
  id: string;
  firstName: string;
  lastName: string;
  studentNumber: string | null;
  gender: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  guardianEmail: string | null;
  createdAt: string;
}

export const studentService = {
  /** Students = persons that have a student profile. */
  async list(): Promise<StudentRow[]> {
    const rows = await withTenant((tx) =>
      tx
        .select({
          id: persons.id,
          firstName: persons.firstName,
          lastName: persons.lastName,
          studentNumber: studentProfiles.studentNumber,
          gender: studentProfiles.gender,
          guardianName: studentProfiles.guardianName,
          guardianPhone: studentProfiles.guardianPhone,
          guardianEmail: studentProfiles.guardianEmail,
          createdAt: persons.createdAt,
        })
        .from(studentProfiles)
        .innerJoin(persons, eq(persons.id, studentProfiles.personId))
        .orderBy(desc(persons.createdAt)),
    );
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  },

  async create(input: CreateStudentInput): Promise<StudentRow> {
    const { schoolId, orgId } = currentTenant();
    const number = input.studentNumber || `STU-${Date.now().toString().slice(-6)}`;

    const row = await withTenant(async (tx) => {
      const [person] = await tx
        .insert(persons)
        .values({ schoolId, orgId, firstName: input.firstName, lastName: input.lastName, dob: input.dob ?? null })
        .returning();
      if (!person) throw new Error("Failed to create person");

      await tx.insert(studentProfiles).values({
        schoolId,
        personId: person.id,
        studentNumber: number,
        gender: input.gender ?? null,
        guardianName: input.guardianName ?? null,
        guardianPhone: input.guardianPhone ?? null,
        guardianEmail: input.guardianEmail ?? null,
      });

      return {
        id: person.id,
        firstName: person.firstName,
        lastName: person.lastName,
        studentNumber: number,
        gender: input.gender ?? null,
        guardianName: input.guardianName ?? null,
        guardianPhone: input.guardianPhone ?? null,
        guardianEmail: input.guardianEmail ?? null,
        createdAt: person.createdAt.toISOString(),
      } satisfies StudentRow;
    });

    // Optional immediate enrolment (emits StudentEnrolled → the ripple).
    if (input.classId && input.termId) {
      await enrollmentService.enroll({ studentId: row.id, classId: input.classId, termId: input.termId });
    }
    return row;
  },
};
