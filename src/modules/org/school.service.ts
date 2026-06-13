import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { schools } from "../../db/schema/index.js";

export const schoolService = {
  /** Public-safe school lookup by slug (used by the login pages before auth). */
  async bySlug(slug: string): Promise<{ id: string; name: string; slug: string } | null> {
    const [row] = await db
      .select({ id: schools.id, name: schools.name, slug: schools.slug })
      .from(schools)
      .where(eq(schools.slug, slug))
      .limit(1);
    return row ?? null;
  },
};
