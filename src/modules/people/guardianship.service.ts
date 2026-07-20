import { eq } from "drizzle-orm";
import { guardianships, type Guardianship } from "../../db/schema/guardianships.js";
import { currentTenant, withTenant } from "../../tenant/context.js";
import type { LinkGuardianInput } from "./people.schema.js";

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
