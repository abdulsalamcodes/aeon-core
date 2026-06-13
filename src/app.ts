import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { pinoHttp } from "pino-http";
import { logger } from "./config/logger.js";
import { authenticate } from "./auth/middleware.js";
import { tenantResolver } from "./tenant/middleware.js";
import { HttpError } from "./lib/http-error.js";
import { authRouter } from "./modules/identity/index.js";
import { subjectRouter } from "./modules/subjects/index.js";

export function createApp(): Express {
  const app = express();

  app.use(pinoHttp({ logger }));
  app.use(express.json({ limit: "1mb" }));

  // Liveness — no auth, no tenant.
  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  // Auth surface: /login is public, /me authenticates itself. Mounted BEFORE the
  // tenant-scoped block so login can choose a tenant.
  app.use("/v1/auth", authRouter);

  // Everything else: authenticate → bind tenant (RLS) → handlers.
  app.use("/v1", authenticate, tenantResolver);
  app.use("/v1/subjects", subjectRouter);

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
