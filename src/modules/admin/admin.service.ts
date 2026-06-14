import { z } from "zod";
import { eq, count } from "drizzle-orm";
import { db } from "../../db/client.js";
import { accounts, organizations, schools, studentProfiles, memberships } from "../../db/schema/index.js";
import { verifyPassword } from "../../auth/password.js";
import { signAccessToken } from "../../auth/jwt.js";
import { HttpError } from "../../lib/http-error.js";
import { runWithTenant } from "../../tenant/context.js";
import { provisionService } from "../identity/index.js";

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export const adminLoginInput = z.object({ email: z.string().email(), password: z.string().min(1) });
export const createInstitutionInput = z.object({
  schoolName: z.string().trim().min(1),
  name: z.string().trim().min(1), // proprietor/admin name
  email: z.string().email(),
  password: z.string().min(8),
});

export const adminService = {
  async login(input: z.infer<typeof adminLoginInput>): Promise<{ accessToken: string; email: string }> {
    const [account] = await db.select().from(accounts).where(eq(accounts.email, input.email.toLowerCase())).limit(1);
    if (!account || !account.isSuperAdmin || account.status !== "active") throw new HttpError(401, "Invalid credentials");
    if (!(await verifyPassword(input.password, account.passwordHash))) throw new HttpError(401, "Invalid credentials");
    const accessToken = await signAccessToken({ sub: account.id, schoolId: "", orgId: "", role: "super-admin", orgWide: true });
    return { accessToken, email: account.email };
  },

  /** All institutions (schools) with simple counts. Super-admin only; cross-tenant. */
  async listInstitutions() {
    const rows = await db
      .select({ id: schools.id, name: schools.name, slug: schools.slug, orgId: schools.orgId, orgName: organizations.name, createdAt: schools.createdAt })
      .from(schools)
      .innerJoin(organizations, eq(organizations.id, schools.orgId));
    // counts per school (small N — fine to loop)
    const result = [];
    for (const s of rows) {
      const [stu] = await db.select({ n: count() }).from(studentProfiles).where(eq(studentProfiles.schoolId, s.id));
      const [stf] = await db.select({ n: count() }).from(memberships).where(eq(memberships.schoolId, s.id));
      result.push({ ...s, createdAt: s.createdAt.toISOString(), totalStudents: stu?.n ?? 0, totalStaff: stf?.n ?? 0 });
    }
    return result;
  },

  /** Onboards a new institution: org + school + first school-admin. */
  async createInstitution(input: z.infer<typeof createInstitutionInput>) {
    const slug = slugify(input.schoolName);
    const [org] = await db.insert(organizations).values({ name: input.schoolName, slug: `${slug}-org` }).returning();
    const [school] = await db.insert(schools).values({ orgId: org!.id, name: input.schoolName, slug }).returning();
    await provisionService.ensureSystemRoles();
    await runWithTenant({ schoolId: school!.id, orgId: org!.id }, () => {
      const [firstName, ...rest] = input.name.split(" ");
      return provisionService.addPrincipal({
        email: input.email,
        password: input.password,
        firstName: firstName ?? input.name,
        lastName: rest.join(" ") || ".",
        role: "school-admin",
      });
    });
    return { id: school!.id, name: school!.name, slug: school!.slug, orgId: org!.id, loginUrl: `/s/${school!.slug}` };
  },
};
