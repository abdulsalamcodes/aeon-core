import { z } from "zod";
import { eq } from "drizzle-orm";
import { guardianships, type Guardianship } from "../../db/schema/guardianships.js";
import { currentTenant, withTenant } from "../../tenant/context.js";

export const linkGuardianInput = z.object({
  guardianId: z.string().uuid(),
  studentId: z.string().uuid(),
  relationship: z.string().trim().max(60).optional(),
});
export type LinkGuardianInput = z.infer<typeof linkGuardianInput>;

export const guardianshipService = {
  async link(input: LinkGuardianInput): Promise<Guardianship> {
    const { schoolId } = currentTenant();
    return withTenant(async (tx) => {
      const [row] = await tx
        .insert(guardianships)
        .values({
          schoolId,
          guardianId: input.guardianId,
          studentId: input.studentId,
          relationship: input.relationship,
        })
        .returning();
      if (!row) throw new Error("Failed to link guardian");
      return row;
    });
  },

  async listForStudent(studentId: string): Promise<Guardianship[]> {
    return withTenant((tx) =>
      tx.select().from(guardianships).where(eq(guardianships.studentId, studentId)),
    );
  },
};
