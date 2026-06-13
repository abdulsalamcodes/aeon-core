import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { pinoHttp } from "pino-http";
import { logger } from "./config/logger.js";
import { tenantResolver } from "./tenant/middleware.js";
import { subjectRouter } from "./modules/subjects/index.js";

export function createApp(): Express {
  const app = express();

  app.use(pinoHttp({ logger }));
  app.use(express.json({ limit: "1mb" }));

  // Liveness — no tenant required.
  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  // Everything below is tenant-scoped (RLS bound per request).
  app.use("/v1", tenantResolver);
  app.use("/v1/subjects", subjectRouter);

  // Central error handler.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    logger.error({ err }, "request failed");
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
