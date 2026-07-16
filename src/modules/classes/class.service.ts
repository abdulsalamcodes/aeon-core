import { z } from "zod";
import { eq, isNull } from "drizzle-orm";
import { classes, persons } from "../../db/schema/index.js";
import { currentTenant, withTenant } from "../../tenant/context.js";

export const createClassInput = z.object({
  name: z.string().trim().min(1),
  classTeacherId: z.string().uuid().optional(),
});
export type CreateClassInput = z.infer<typeof createClassInput>;

export interface ClassRow {
  id: string;
  name: string;
  classTeacherId: string | null;
  classTeacherName: string | null;
  createdAt: string;
}

export const classService = {
  async list(): Promise<ClassRow[]> {
    const rows = await withTenant((tx) =>
      tx
        .select({
          id: classes.id,
          name: classes.name,
          classTeacherId: classes.classTeacherId,
          teacherFirst: persons.firstName,
          teacherLast: persons.lastName,
          createdAt: classes.createdAt,
        })
        .from(classes)
        .leftJoin(persons, eq(persons.id, classes.classTeacherId))
        .where(isNull(classes.deletedAt)),
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      classTeacherId: r.classTeacherId,
      classTeacherName: r.teacherFirst
        ? `${r.teacherFirst} ${r.teacherLast}`
        : null,
      createdAt: r.createdAt.toISOString(),
    }));
  },

  async update(id: string, input: Partial<CreateClassInput>): Promise<void> {
    await withTenant((tx) =>
      tx
        .update(classes)
        .set({
          ...(input.name ? { name: input.name } : {}),
          ...(input.classTeacherId !== undefined
            ? { classTeacherId: input.classTeacherId || null }
            : {}),
        })
        .where(eq(classes.id, id)),
    );
  },

  async remove(id: string): Promise<void> {
    await withTenant((tx) =>
      tx
        .update(classes)
        .set({ deletedAt: new Date() })
        .where(eq(classes.id, id)),
    );
  },

  async create(input: CreateClassInput): Promise<ClassRow> {
    const { schoolId, orgId } = currentTenant();
    return withTenant(async (tx) => {
      const [row] = await tx
        .insert(classes)
        .values({
          schoolId,
          orgId,
          name: input.name,
          classTeacherId: input.classTeacherId ?? null,
        })
        .returning();
      if (!row) throw new Error("Failed to create class");
      return {
        id: row.id,
        name: row.name,
        classTeacherId: row.classTeacherId,
        classTeacherName: null,
        createdAt: row.createdAt.toISOString(),
      };
    });
  },
};
