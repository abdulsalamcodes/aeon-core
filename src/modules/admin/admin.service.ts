import { z } from "zod";
import { eq, count, and, desc, sql, isNull } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  accounts,
  organizations,
  schools,
  studentProfiles,
  memberships,
  outboxEvents,
  notifications,
} from "../../db/schema/index.js";
import { verifyPassword } from "../../auth/password.js";
import { signAccessToken } from "../../auth/jwt.js";
import { HttpError } from "../../lib/http-error.js";
import { provisionService } from "../identity/index.js";

export const adminLoginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export const createInstitutionInput = z.object({
  schoolName: z.string().trim().min(1),
  name: z.string().trim().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});
export const createAdminInput = z.object({
  name: z.string().trim().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});
export const updateAdminInput = z.object({
  status: z.enum(["active", "disabled"]).optional(),
});

export const adminService = {
  async login(
    input: z.infer<typeof adminLoginInput>,
  ): Promise<{ accessToken: string; email: string }> {
    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.email, input.email.toLowerCase()))
      .limit(1);
    if (!account || !account.isSuperAdmin || account.status !== "active")
      throw new HttpError(401, "Invalid credentials");
    if (!(await verifyPassword(input.password, account.passwordHash)))
      throw new HttpError(401, "Invalid credentials");
    const accessToken = await signAccessToken({
      sub: account.id,
      schoolId: "",
      orgId: "",
      role: "super-admin",
      orgWide: true,
    });
    return { accessToken, email: account.email };
  },

  async listInstitutions() {
    const rows = await db
      .select({
        id: schools.id,
        name: schools.name,
        slug: schools.slug,
        orgId: schools.orgId,
        orgName: organizations.name,
        createdAt: schools.createdAt,
      })
      .from(schools)
      .innerJoin(organizations, eq(organizations.id, schools.orgId));
    const result = [];
    for (const s of rows) {
      const [stu] = await db
        .select({ n: count() })
        .from(studentProfiles)
        .where(eq(studentProfiles.schoolId, s.id));
      const [stf] = await db
        .select({ n: count() })
        .from(memberships)
        .where(
          and(eq(memberships.schoolId, s.id), sql`role_name != 'student'`),
        );
      result.push({
        ...s,
        createdAt: s.createdAt.toISOString(),
        totalStudents: stu?.n ?? 0,
        totalStaff: stf?.n ?? 0,
      });
    }
    return result;
  },

  async createInstitution(input: z.infer<typeof createInstitutionInput>) {
    const school = await provisionService.provisionSchool({
      schoolName: input.schoolName,
      adminName: input.name,
      adminEmail: input.email,
      adminPassword: input.password,
      emailVerified: true,
    });
    return {
      id: school.schoolId,
      name: input.schoolName,
      slug: school.slug,
      orgId: school.orgId,
      loginUrl: `/s/${school.slug}`,
    };
  },

  async dashboard() {
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    const [inst] = await db.select({ n: count() }).from(schools);
    const [stu] = await db.select({ n: count() }).from(studentProfiles);
    const [stf] = await db
      .select({ n: count() })
      .from(memberships)
      .where(sql`role_name != 'student'`);
    const [superAdmins] = await db
      .select({ n: count() })
      .from(accounts)
      .where(eq(accounts.isSuperAdmin, true));
    const [newThisMonth] = await db
      .select({ n: count() })
      .from(schools)
      .where(sql`created_at >= ${monthAgo.toISOString()}`);

    const activity = await db
      .select({
        id: outboxEvents.id,
        schoolName: schools.name,
        eventType: outboxEvents.eventType,
        actorName: outboxEvents.actorName,
        createdAt: outboxEvents.createdAt,
      })
      .from(outboxEvents)
      .leftJoin(schools, eq(schools.id, outboxEvents.schoolId))
      .orderBy(desc(outboxEvents.createdAt))
      .limit(20);

    const top = await db
      .select({
        id: schools.id,
        name: schools.name,
        slug: schools.slug,
        totalStudents: sql<number>`(SELECT count(*) FROM ${studentProfiles} WHERE ${studentProfiles.schoolId} = ${schools.id})`,
        totalStaff: sql<number>`(SELECT count(*) FROM ${memberships} WHERE ${memberships.schoolId} = ${schools.id} AND role_name != 'student')`,
      })
      .from(schools)
      .orderBy(
        desc(
          sql`(SELECT count(*) FROM ${studentProfiles} WHERE ${studentProfiles.schoolId} = ${schools.id})`,
        ),
      )
      .limit(5);

    return {
      totalInstitutions: inst?.n ?? 0,
      totalStudents: stu?.n ?? 0,
      totalStaff: stf?.n ?? 0,
      totalSuperAdmins: superAdmins?.n ?? 0,
      newThisMonth: newThisMonth?.n ?? 0,
      activity: activity.map((r) => ({
        ...r,
        schoolName: r.schoolName ?? "Unknown",
        actorName: r.actorName ?? "System",
        createdAt: r.createdAt.toISOString(),
      })),
      topInstitutions: top.map((r) => ({
        ...r,
        totalStudents: Number(r.totalStudents),
        totalStaff: Number(r.totalStaff),
      })),
    };
  },

  async listAdmins() {
    const rows = await db
      .select({
        id: accounts.id,
        email: accounts.email,
        status: accounts.status,
        createdAt: accounts.createdAt,
      })
      .from(accounts)
      .where(eq(accounts.isSuperAdmin, true))
      .orderBy(desc(accounts.createdAt));
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  },

  async createAdmin(input: z.infer<typeof createAdminInput>) {
    const existing = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.email, input.email.toLowerCase()))
      .limit(1);
    if (existing.length > 0)
      throw new HttpError(409, "An account with this email already exists");

    const { hashPassword } = await import("../../auth/password.js");
    const passwordHash = await hashPassword(input.password);

    const [account] = await db
      .insert(accounts)
      .values({
        email: input.email.toLowerCase(),
        passwordHash,
        isSuperAdmin: true,
        status: "active",
        emailVerified: true,
      })
      .returning({
        id: accounts.id,
        email: accounts.email,
        status: accounts.status,
        createdAt: accounts.createdAt,
      });

    return { ...account!, createdAt: account!.createdAt.toISOString() };
  },

  async updateAdmin(id: string, input: z.infer<typeof updateAdminInput>) {
    const [account] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, id), eq(accounts.isSuperAdmin, true)))
      .limit(1);
    if (!account) throw new HttpError(404, "Super admin not found");

    const updates: Record<string, unknown> = {};
    if (input.status) updates.status = input.status;

    await db.update(accounts).set(updates).where(eq(accounts.id, id));
    return { id };
  },

  async getInstitutionDetail(id: string) {
    const [school] = await db
      .select({
        id: schools.id,
        name: schools.name,
        slug: schools.slug,
        orgId: schools.orgId,
        orgName: organizations.name,
        createdAt: schools.createdAt,
      })
      .from(schools)
      .innerJoin(organizations, eq(organizations.id, schools.orgId))
      .where(eq(schools.id, id))
      .limit(1);
    if (!school) throw new HttpError(404, "Institution not found");

    const [stu] = await db
      .select({ n: count() })
      .from(studentProfiles)
      .where(eq(studentProfiles.schoolId, school.id));
    const [stf] = await db
      .select({ n: count() })
      .from(memberships)
      .where(
        and(eq(memberships.schoolId, school.id), sql`role_name != 'student'`),
      );

    const recentActivity = await db
      .select({
        id: outboxEvents.id,
        eventType: outboxEvents.eventType,
        actorName: outboxEvents.actorName,
        createdAt: outboxEvents.createdAt,
      })
      .from(outboxEvents)
      .where(eq(outboxEvents.schoolId, school.id))
      .orderBy(desc(outboxEvents.createdAt))
      .limit(10);

    const staff = await db
      .select({
        id: memberships.id,
        personId: memberships.personId,
        roleName: memberships.roleName,
      })
      .from(memberships)
      .where(
        and(eq(memberships.schoolId, school.id), sql`role_name != 'student'`),
      );

    return {
      id: school.id,
      name: school.name,
      slug: school.slug,
      orgName: school.orgName,
      createdAt: school.createdAt.toISOString(),
      totalStudents: stu?.n ?? 0,
      totalStaff: stf?.n ?? 0,
      staffCount: staff.length,
      recentActivity: recentActivity.map((r) => ({
        ...r,
        actorName: r.actorName ?? "System",
        createdAt: r.createdAt.toISOString(),
      })),
    };
  },

  async health() {
    const [queueDepth] = await db
      .select({ n: count() })
      .from(outboxEvents)
      .where(isNull(outboxEvents.publishedAt));
    const [notifSent] = await db
      .select({ n: count() })
      .from(notifications)
      .where(eq(notifications.status, "sent"));
    const [notifFailed] = await db
      .select({ n: count() })
      .from(notifications)
      .where(eq(notifications.status, "failed"));
    const [notifQueued] = await db
      .select({ n: count() })
      .from(notifications)
      .where(eq(notifications.status, "queued"));

    const channelStats = await db
      .select({ channel: notifications.channel, n: count() })
      .from(notifications)
      .groupBy(notifications.channel);

    return {
      database: "connected",
      outboxQueueDepth: queueDepth?.n ?? 0,
      notifications: {
        sent: notifSent?.n ?? 0,
        failed: notifFailed?.n ?? 0,
        queued: notifQueued?.n ?? 0,
        byChannel: channelStats.map((r) => ({
          channel: r.channel,
          count: r.n,
        })),
      },
      timestamp: new Date().toISOString(),
    };
  },
};
