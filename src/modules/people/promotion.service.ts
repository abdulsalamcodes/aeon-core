import { and, eq, inArray } from "drizzle-orm";
import { enrollments, studentProfiles, persons } from "../../db/schema/index.js";
import { currentTenant, withTenant } from "../../tenant/context.js";
import type { PromoteInput } from "./people.schema.js";

export const promotionService = {
  /** Moves students from one class to another for the term (updates enrolments). */
  async promote(input: PromoteInput): Promise<{ promoted: number }> {
    const { schoolId, orgId } = currentTenant();
    return withTenant(async (tx) => {
      // Resolve the active term to operate on (caller may pass one).
      const termId = input.termId ?? (await tx.select({ id: enrollments.termId }).from(enrollments).where(eq(enrollments.classId, input.fromClassId)).limit(1))[0]?.id;
      if (!termId) return { promoted: 0 };

      const ids = input.studentIds && input.studentIds.length > 0 ? input.studentIds : undefined;
      const cond = ids
        ? and(eq(enrollments.classId, input.fromClassId), eq(enrollments.termId, termId), inArray(enrollments.studentId, ids))
        : and(eq(enrollments.classId, input.fromClassId), eq(enrollments.termId, termId));

      const rows = await tx.select({ id: enrollments.id, studentId: enrollments.studentId }).from(enrollments).where(cond);
      for (const r of rows) {
        // Close the old enrolment, open a new one in the target class.
        await tx.update(enrollments).set({ unenrolledAt: new Date() }).where(eq(enrollments.id, r.id));
        await tx.insert(enrollments).values({ schoolId, orgId, studentId: r.studentId, classId: input.toClassId, termId }).onConflictDoNothing();
      }
      return { promoted: rows.length };
    });
  },

  /** Students as CSV (for the export feature). */
  async exportCsv(): Promise<string> {
    const rows = await withTenant((tx) =>
      tx
        .select({ firstName: persons.firstName, lastName: persons.lastName, studentNumber: studentProfiles.studentNumber, gender: studentProfiles.gender, guardianName: studentProfiles.guardianName, guardianPhone: studentProfiles.guardianPhone })
        .from(studentProfiles)
        .innerJoin(persons, eq(persons.id, studentProfiles.personId)),
    );
    const header = "firstname,lastname,studentNumber,gender,guardianName,guardianPhone";
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = rows.map((r) => [r.firstName, r.lastName, r.studentNumber, r.gender, r.guardianName, r.guardianPhone].map(esc).join(","));
    return [header, ...lines].join("\n");
  },
};
