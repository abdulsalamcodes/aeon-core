import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { pinoHttp } from "pino-http";
import { logger } from "./config/logger.js";
import { authenticate } from "./auth/middleware.js";
import { tenantResolver } from "./tenant/middleware.js";
import { HttpError } from "./lib/http-error.js";
import { authRouter } from "./modules/identity/index.js";
import { publicOrgRouter } from "./modules/org/index.js";
import { subjectRouter } from "./modules/subjects/index.js";
import { classRouter } from "./modules/classes/index.js";
import { peopleRouter } from "./modules/people/index.js";
import { academicsRouter } from "./modules/academics/index.js";
import { academicRouter } from "./modules/academic/index.js";
import { insightsRouter } from "./modules/insights/index.js";
import { financeRouter } from "./modules/finance/index.js";
import { notificationsRouter } from "./modules/notifications/index.js";
import { workflowRouter } from "./modules/workflow/index.js";
import { registerDefaultProviders } from "./payments/index.js";
import { registerDefaultChannels } from "./notifications/index.js";

export function createApp(): Express {
  registerDefaultProviders();
  registerDefaultChannels();
  const app = express();

  app.use(pinoHttp({ logger }));

  // CORS — allow the web app (browser) to call the API with its bearer token.
  // Reflects the request origin; tighten to an allowlist in production.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-School-Id, X-Org-Id");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.use(express.json({ limit: "1mb" }));

  // Liveness — no auth, no tenant.
  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  // Public surface (no auth): login + school lookup for the login pages.
  app.use("/v1/auth", authRouter);
  app.use("/v1/public", publicOrgRouter);

  // Everything else: authenticate → bind tenant (RLS) → handlers.
  app.use("/v1", authenticate, tenantResolver);
  app.use("/v1/subjects", subjectRouter);
  app.use("/v1/classes", classRouter);
  app.use("/v1/people", peopleRouter);
  app.use("/v1/academics", academicsRouter);
  app.use("/v1/academic", academicRouter);
  app.use("/v1/stats", insightsRouter);
  app.use("/v1/finance", financeRouter);
  app.use("/v1/notifications", notificationsRouter);
  app.use("/v1/workflows", workflowRouter);

  // Central error handler — maps HttpError to its status.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    logger.error({ err }, "request failed");
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
