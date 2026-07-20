import { eq } from "drizzle-orm";
import { terms, type Term } from "../../db/schema/terms.js";
import { currentTenant, withTenant } from "../../tenant/context.js";
import type { CreateTermInput } from "./academic.schema.js";

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

  async update(id: string, patch: { name?: string; startDate?: string; endDate?: string }): Promise<void> {
    await withTenant((tx) =>
      tx
        .update(terms)
        .set({
          ...(patch.name ? { name: patch.name } : {}),
          ...(patch.startDate ? { startDate: patch.startDate } : {}),
          ...(patch.endDate ? { endDate: patch.endDate } : {}),
        })
        .where(eq(terms.id, id)),
    );
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
