import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { pinoHttp } from "pino-http";
import { logger } from "./config/logger.js";
import { authenticate } from "./auth/middleware.js";
import { tenantResolver } from "./tenant/middleware.js";
import { HttpError } from "./lib/http-error.js";
import { corsMiddleware } from "./lib/cors.js";
import { rateLimit } from "./lib/rate-limit.js";
import { authRouter } from "./modules/identity/index.js";
import { publicOrgRouter, orgRouter } from "./modules/org/index.js";
import { subjectRouter } from "./modules/subjects/index.js";
import { classRouter } from "./modules/classes/index.js";
import { peopleRouter } from "./modules/people/index.js";
import { academicsRouter } from "./modules/academics/index.js";
import { academicRouter } from "./modules/academic/index.js";
import { insightsRouter } from "./modules/insights/index.js";
import { financeRouter, paystackWebhookRouter } from "./modules/finance/index.js";
import { calendarRouter, timetableRouter } from "./modules/schedule/index.js";
import { uploadsRouter } from "./modules/uploads/index.js";
import { notificationsRouter } from "./modules/notifications/index.js";
import { workflowRouter } from "./modules/workflow/index.js";
import { portalAuthRouter, portalRouter } from "./modules/portal/index.js";
import { adminAuthRouter, adminRouter } from "./modules/admin/index.js";
import { registerDefaultProviders } from "./payments/index.js";
import { registerDefaultChannels } from "./notifications/index.js";
import { registerDefaultStorage } from "./storage/index.js";

// Headroom for bulk text payloads (CSV import, dev-only inline photo data URLs).
const BULK_JSON_LIMIT = "5mb";

export function createApp(): Express {
  registerDefaultProviders();
  registerDefaultChannels();
  registerDefaultStorage();
  const app = express();

  app.use(pinoHttp({ logger }));

  // CORS — reflect allowed browser origins (allowlist enforced in production).
  app.use(corsMiddleware);

  // Gateway webhooks verify an HMAC over the raw body — mount before json parsing.
  // Throttle generously: signature-verified, but still an unauthenticated surface.
  const webhookThrottle = rateLimit({ name: "webhook", max: 120, windowMs: 60_000 });
  app.use("/v1/public/payments", webhookThrottle, paystackWebhookRouter);

  // Bulk endpoints carry large text bodies (a whole CSV / a dev-only photo data
  // URL), so they opt into a higher limit before the default parser. Production
  // photo uploads go directly to R2, so the general API keeps Express's standard
  // 100 KB default.
  app.use("/v1/people/students/import", express.json({ limit: BULK_JSON_LIMIT }));
  app.use("/v1/uploads/photo", express.json({ limit: BULK_JSON_LIMIT }));

  app.use(express.json());

  // Liveness — no auth, no tenant.
  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  // Public credential surfaces are brute-forceable — throttle per client IP.
  // A separate budget per surface avoids one busy surface starving another;
  // the limit tolerates a morning login rush behind a shared school NAT while
  // still stopping a scripted brute force. Per-account throttling is roadmap.
  const loginThrottle = () => rateLimit({ name: "login", max: 30, windowMs: 60_000 });

  // Public surface (no auth): login + school lookup for the login pages.
  app.use("/v1/auth", loginThrottle(), authRouter);
  app.use("/v1/public", publicOrgRouter);
  app.use("/v1/portal/auth", loginThrottle(), portalAuthRouter);
  app.use("/v1/admin/auth", loginThrottle(), adminAuthRouter);

  // Super-admin area: authenticated but NOT tenant-bound (spans all schools).
  // Mounted before the tenant block so tenantResolver doesn't require a school.
  app.use("/v1/admin", adminRouter);

  // Everything else: authenticate → bind tenant (RLS) → handlers.
  app.use("/v1", authenticate, tenantResolver);
  app.use("/v1/org", orgRouter);
  app.use("/v1/subjects", subjectRouter);
  app.use("/v1/classes", classRouter);
  app.use("/v1/people", peopleRouter);
  app.use("/v1/academics", academicsRouter);
  app.use("/v1/academic", academicRouter);
  app.use("/v1/stats", insightsRouter);
  app.use("/v1/finance", financeRouter);
  app.use("/v1/calendar", calendarRouter);
  app.use("/v1/timetable", timetableRouter);
  app.use("/v1/uploads", uploadsRouter);
  app.use("/v1/notifications", notificationsRouter);
  app.use("/v1/workflows", workflowRouter);
  app.use("/v1/portal", portalRouter);

  // Central error handler — maps HttpError and framework 4xx errors (e.g. a
  // too-large or malformed body) to their status; everything else is a 500.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    const clientStatus = clientErrorStatus(err);
    if (clientStatus) {
      res.status(clientStatus).json({ error: (err as Error).message });
      return;
    }
    logger.error({ err }, "request failed");
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}

/** Reads the HTTP status Express middleware (body-parser, etc.) attach to 4xx errors. */
function clientErrorStatus(err: unknown): number | null {
  const status = (err as { status?: number; statusCode?: number }).status ?? (err as { statusCode?: number }).statusCode;
  return typeof status === "number" && status >= 400 && status < 500 ? status : null;
}
