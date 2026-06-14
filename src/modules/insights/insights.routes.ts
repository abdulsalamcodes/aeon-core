import { Router } from "express";
import { count, ne, eq, desc } from "drizzle-orm";
import { studentProfiles, memberships, classes, attendance, outboxEvents } from "../../db/schema/index.js";
import { withTenant } from "../../tenant/context.js";

/** School-level summary stats + activity feed for the dashboard / inbox. */
export const insightsRouter: Router = Router();

insightsRouter.get("/activity", async (_req, res, next) => {
  try {
    const rows = await withTenant((tx) =>
      tx
        .select({ id: outboxEvents.id, aggregate: outboxEvents.aggregate, eventType: outboxEvents.eventType, payload: outboxEvents.payload, actorName: outboxEvents.actorName, createdAt: outboxEvents.createdAt })
        .from(outboxEvents)
        .orderBy(desc(outboxEvents.createdAt))
        .limit(40),
    );
    res.json({ data: rows.map((r) => ({ ...r, actorName: r.actorName ?? "System", createdAt: r.createdAt.toISOString() })) });
  } catch (err) {
    next(err);
  }
});

insightsRouter.get("/", async (_req, res, next) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const data = await withTenant(async (tx) => {
      const [students] = await tx.select({ n: count() }).from(studentProfiles);
      const [staff] = await tx.select({ n: count() }).from(memberships).where(ne(memberships.roleName, "student"));
      const [cls] = await tx.select({ n: count() }).from(classes);
      const [present] = await tx
        .select({ n: count() })
        .from(attendance)
        .where(eq(attendance.status, "present"));
      return {
        totalStudents: students?.n ?? 0,
        totalStaff: staff?.n ?? 0,
        totalClasses: cls?.n ?? 0,
        presentToday: present?.n ?? 0,
        date: today,
      };
    });
    res.json({ data });
  } catch (err) {
    next(err);
  }
});
