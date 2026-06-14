import { z } from "zod";
import { eq } from "drizzle-orm";
import { terms, type Term } from "../../db/schema/terms.js";
import { currentTenant, withTenant } from "../../tenant/context.js";

export const createTermInput = z.object({
  name: z.string().trim().min(1),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  isCurrent: z.boolean().optional(),
});
export type CreateTermInput = z.infer<typeof createTermInput>;

export const termService = {
  async list(): Promise<Term[]> {
    return withTenant((tx) => tx.select().from(terms));
  },

  async current(): Promise<Term | null> {
    const rows = await withTenant((tx) => tx.select().from(terms).where(eq(terms.isCurrent, true)).limit(1));
    return rows[0] ?? null;
  },

  async create(input: CreateTermInput): Promise<Term> {
    const { schoolId, orgId } = currentTenant();
    return withTenant(async (tx) => {
      if (input.isCurrent) await tx.update(terms).set({ isCurrent: false });
      const [row] = await tx
        .insert(terms)
        .values({
          schoolId,
          orgId,
          name: input.name,
          startDate: input.startDate ?? null,
          endDate: input.endDate ?? null,
          isCurrent: input.isCurrent ?? false,
        })
        .returning();
      if (!row) throw new Error("Failed to create term");
      return row;
    });
  },

  async setCurrent(termId: string): Promise<Term> {
    return withTenant(async (tx) => {
      await tx.update(terms).set({ isCurrent: false });
      const [row] = await tx.update(terms).set({ isCurrent: true }).where(eq(terms.id, termId)).returning();
      if (!row) throw new Error("Term not found");
      return row;
    });
  },
};
