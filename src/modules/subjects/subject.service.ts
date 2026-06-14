import { z } from "zod";
import { isNull, eq } from "drizzle-orm";
import { subjects, type Subject } from "../../db/schema/subjects.js";
import { currentTenant, withTenant } from "../../tenant/context.js";
import { emit } from "../../events/outbox.js";

export const createSubjectInput = z.object({
  name: z.string().trim().min(1).max(120),
});
export type CreateSubjectInput = z.infer<typeof createSubjectInput>;

/**
 * Public service interface for the Subjects module. Other modules call THESE
 * functions or react to its events — they never touch the `subjects` table
 * directly (ADR-3 boundary rule, enforced by lint).
 */
export const subjectService = {
  async list(): Promise<Subject[]> {
    // RLS scopes this to the current school automatically; the explicit
    // soft-delete filter is belt-and-braces.
    return withTenant((tx) => tx.select().from(subjects).where(isNull(subjects.deletedAt)));
  },

  async create(input: CreateSubjectInput): Promise<Subject> {
    const { schoolId, orgId } = currentTenant();
    return withTenant(async (tx) => {
      const [row] = await tx
        .insert(subjects)
        .values({ schoolId, orgId, name: input.name })
        .returning();
      if (!row) throw new Error("Insert failed");

      // Same transaction as the write → event can't be lost (outbox pattern).
      await emit(tx, schoolId, {
        aggregate: "subject",
        aggregateId: row.id,
        eventType: "SubjectCreated",
        payload: { id: row.id, name: row.name },
      });
      return row;
    });
  },

  async update(id: string, name: string): Promise<void> {
    await withTenant((tx) => tx.update(subjects).set({ name }).where(eq(subjects.id, id)));
  },

  async remove(id: string): Promise<void> {
    await withTenant((tx) => tx.update(subjects).set({ deletedAt: new Date() }).where(eq(subjects.id, id)));
  },
};
