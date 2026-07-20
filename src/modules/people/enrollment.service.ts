import { isNull } from "drizzle-orm";
import { enrollments, type Enrollment } from "../../db/schema/enrollments.js";
import { currentTenant, withTenant } from "../../tenant/context.js";
import { emit } from "../../events/outbox.js";
import type { EnrollInput } from "./people.schema.js";

export const STUDENT_ENROLLED = "StudentEnrolled";

export const enrollmentService = {
  async list(): Promise<Enrollment[]> {
    return withTenant((tx) => tx.select().from(enrollments).where(isNull(enrollments.unenrolledAt)));
  },

  /**
   * Enrols a student into a class for a term and emits `StudentEnrolled` in the
   * SAME transaction (ADR-5). Downstream modules react to the event — academics
   * seeds the attendance register, finance assigns fees (Phase 3), notifications
   * invites the guardian — none of which this module knows about. The ripple.
   */
  async enroll(input: EnrollInput): Promise<Enrollment> {
    const { schoolId, orgId } = currentTenant();
    return withTenant(async (tx) => {
      const [row] = await tx
        .insert(enrollments)
        .values({ schoolId, orgId, studentId: input.studentId, classId: input.classId, termId: input.termId })
        .returning();
      if (!row) throw new Error("Failed to enroll");

      await emit(tx, schoolId, {
        aggregate: "enrollment",
        aggregateId: row.id,
        eventType: STUDENT_ENROLLED,
        payload: {
          enrollmentId: row.id,
          studentId: row.studentId,
          classId: row.classId,
          termId: row.termId,
          schoolId,
          orgId,
        },
      });
      return row;
    });
  },
};
