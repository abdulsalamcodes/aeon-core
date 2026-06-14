import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { persons, studentProfiles, classes, enrollments } from "../../db/schema/index.js";
import { currentTenant, withTenant } from "../../tenant/context.js";
import { enrollmentService } from "./enrollment.service.js";

export const createStudentInput = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  studentNumber: z.string().trim().optional(),
  gender: z.enum(["male", "female"]).optional(),
  dob: z.string().optional(),
  guardianName: z.string().trim().optional(),
  guardianPhone: z.string().trim().optional(),
  guardianEmail: z.string().trim().optional(),
  // Optional immediate enrolment → fires the StudentEnrolled ripple.
  classId: z.string().uuid().optional(),
  termId: z.string().uuid().optional(),
});
export type CreateStudentInput = z.infer<typeof createStudentInput>;

export interface StudentRow {
  id: string;
  firstName: string;
  lastName: string;
  studentNumber: string | null;
  gender: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  guardianEmail: string | null;
  createdAt: string;
}

export const studentService = {
  /** Students = persons that have a student profile. */
  async list(): Promise<StudentRow[]> {
    const rows = await withTenant((tx) =>
      tx
        .select({
          id: persons.id,
          firstName: persons.firstName,
          lastName: persons.lastName,
          studentNumber: studentProfiles.studentNumber,
          gender: studentProfiles.gender,
          guardianName: studentProfiles.guardianName,
          guardianPhone: studentProfiles.guardianPhone,
          guardianEmail: studentProfiles.guardianEmail,
          createdAt: persons.createdAt,
        })
        .from(studentProfiles)
        .innerJoin(persons, eq(persons.id, studentProfiles.personId))
        .orderBy(desc(persons.createdAt)),
    );
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  },

  async create(input: CreateStudentInput): Promise<StudentRow> {
    const { schoolId, orgId } = currentTenant();
    const number = input.studentNumber || `STU-${Date.now().toString().slice(-6)}`;

    const row = await withTenant(async (tx) => {
      const [person] = await tx
        .insert(persons)
        .values({ schoolId, orgId, firstName: input.firstName, lastName: input.lastName, dob: input.dob ?? null })
        .returning();
      if (!person) throw new Error("Failed to create person");

      await tx.insert(studentProfiles).values({
        schoolId,
        personId: person.id,
        studentNumber: number,
        gender: input.gender ?? null,
        guardianName: input.guardianName ?? null,
        guardianPhone: input.guardianPhone ?? null,
        guardianEmail: input.guardianEmail ?? null,
      });

      return {
        id: person.id,
        firstName: person.firstName,
        lastName: person.lastName,
        studentNumber: number,
        gender: input.gender ?? null,
        guardianName: input.guardianName ?? null,
        guardianPhone: input.guardianPhone ?? null,
        guardianEmail: input.guardianEmail ?? null,
        createdAt: person.createdAt.toISOString(),
      } satisfies StudentRow;
    });

    // Optional immediate enrolment (emits StudentEnrolled → the ripple).
    if (input.classId && input.termId) {
      await enrollmentService.enroll({ studentId: row.id, classId: input.classId, termId: input.termId });
    }
    return row;
  },

  async get(id: string): Promise<(StudentRow & { className: string | null }) | null> {
    const rows = await withTenant((tx) =>
      tx
        .select({
          id: persons.id,
          firstName: persons.firstName,
          lastName: persons.lastName,
          studentNumber: studentProfiles.studentNumber,
          gender: studentProfiles.gender,
          guardianName: studentProfiles.guardianName,
          guardianPhone: studentProfiles.guardianPhone,
          guardianEmail: studentProfiles.guardianEmail,
          createdAt: persons.createdAt,
          className: classes.name,
        })
        .from(studentProfiles)
        .innerJoin(persons, eq(persons.id, studentProfiles.personId))
        .leftJoin(enrollments, eq(enrollments.studentId, persons.id))
        .leftJoin(classes, eq(classes.id, enrollments.classId))
        .where(eq(persons.id, id))
        .limit(1),
    );
    const r = rows[0];
    return r ? { ...r, createdAt: r.createdAt.toISOString() } : null;
  },

  async update(id: string, input: Partial<CreateStudentInput>): Promise<void> {
    await withTenant(async (tx) => {
      if (input.firstName || input.lastName || input.dob) {
        await tx
          .update(persons)
          .set({
            ...(input.firstName ? { firstName: input.firstName } : {}),
            ...(input.lastName ? { lastName: input.lastName } : {}),
            ...(input.dob ? { dob: input.dob } : {}),
          })
          .where(eq(persons.id, id));
      }
      await tx
        .update(studentProfiles)
        .set({
          ...(input.studentNumber ? { studentNumber: input.studentNumber } : {}),
          ...(input.gender ? { gender: input.gender } : {}),
          ...(input.guardianName !== undefined ? { guardianName: input.guardianName } : {}),
          ...(input.guardianPhone !== undefined ? { guardianPhone: input.guardianPhone } : {}),
          ...(input.guardianEmail !== undefined ? { guardianEmail: input.guardianEmail } : {}),
        })
        .where(eq(studentProfiles.personId, id));
    });
  },

  async remove(id: string): Promise<void> {
    await withTenant((tx) => tx.update(persons).set({ deletedAt: new Date() }).where(eq(persons.id, id)));
  },

  /** Bulk-create students from CSV text. Header row required. Returns per-row outcome. */
  async bulkImport(csv: string): Promise<{ succeeded: number; failed: { row: number; error: string }[] }> {
    const rows = parseCsv(csv);
    if (rows.length === 0) return { succeeded: 0, failed: [] };
    const header = rows[0]!.map((h) => h.trim().toLowerCase());
    const idx = (k: string) => header.indexOf(k);
    const col = (r: string[], k: string) => (idx(k) >= 0 ? r[idx(k)]?.trim() : undefined) || undefined;

    let succeeded = 0;
    const failed: { row: number; error: string }[] = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i]!;
      if (r.every((c) => !c.trim())) continue;
      const firstName = col(r, "firstname") ?? col(r, "first_name");
      const lastName = col(r, "lastname") ?? col(r, "last_name");
      if (!firstName || !lastName) {
        failed.push({ row: i + 1, error: "firstname and lastname are required" });
        continue;
      }
      try {
        await this.create({
          firstName,
          lastName,
          studentNumber: col(r, "studentnumber"),
          gender: (col(r, "gender") as "male" | "female" | undefined) ?? undefined,
          dob: col(r, "dob"),
          guardianName: col(r, "guardianname"),
          guardianPhone: col(r, "guardianphone") ?? col(r, "guardianphonenumber"),
          guardianEmail: col(r, "guardianemail"),
        });
        succeeded++;
      } catch (e) {
        failed.push({ row: i + 1, error: e instanceof Error ? e.message : "Failed" });
      }
    }
    return { succeeded, failed };
  },
};

/** Minimal RFC-4180-ish CSV parser (handles quotes + commas). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); if (row.some((f) => f !== "")) rows.push(row); }
  return rows;
}
