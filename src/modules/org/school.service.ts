import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { schools } from "../../db/schema/index.js";

export interface SchoolContact {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
}

export const schoolService = {
  async bySlug(slug: string): Promise<{ id: string; name: string; slug: string } | null> {
    const [row] = await db
      .select({ id: schools.id, name: schools.name, slug: schools.slug })
      .from(schools)
      .where(eq(schools.slug, slug))
      .limit(1);
    return row ?? null;
  },

  async byId(id: string): Promise<{ id: string; name: string; slug: string; email: string | null; phone: string | null; address: string | null } | null> {
    const [row] = await db
      .select({ id: schools.id, name: schools.name, slug: schools.slug, email: schools.email, phone: schools.phone, address: schools.address })
      .from(schools)
      .where(eq(schools.id, id))
      .limit(1);
    return row ?? null;
  },

  async getSettings(id: string): Promise<Record<string, unknown>> {
    const [row] = await db
      .select({ settings: schools.settings })
      .from(schools)
      .where(eq(schools.id, id))
      .limit(1);
    return row?.settings ?? {};
  },

  /** Shallow-merges the patch into the stored settings and returns the result. */
  async updateSettings(id: string, patch: Record<string, unknown>): Promise<Record<string, unknown>> {
    const current = await this.getSettings(id);
    const merged = { ...current, ...patch };
    await db.update(schools).set({ settings: merged }).where(eq(schools.id, id));
    return merged;
  },

  async update(id: string, fields: SchoolContact): Promise<void> {
    const updates: Partial<typeof schools.$inferInsert> = {};
    if (fields.name    !== undefined) updates.name    = fields.name;
    if (fields.email   !== undefined) updates.email   = fields.email;
    if (fields.phone   !== undefined) updates.phone   = fields.phone;
    if (fields.address !== undefined) updates.address = fields.address;
    if (Object.keys(updates).length > 0) {
      await db.update(schools).set(updates).where(eq(schools.id, id));
    }
  },
};
