import { z } from "zod";

const DEV_JWT_SECRET = "dev-only-insecure-secret-change-me";
const DEV_REFRESH_SECRET = "dev-only-insecure-refresh-secret-change-me";

/**
 * Centralized, validated environment. Fails fast on boot if misconfigured.
 */
const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().default(8080),

    // Postgres — the system of record (ADR-1). Use a pooled connection (PgBouncer) in prod.
    DATABASE_URL: z.string().default("postgres://postgres:postgres@localhost:5432/schooler_core"),

    // Embedded mode: run an in-process Postgres (PGlite) — no external server.
    // Lets the core run/test end-to-end with zero infra. Not for production.
    EMBEDDED_DB: z
      .enum(["true", "false", "1", "0"])
      .default("false")
      .transform((v) => v === "true" || v === "1"),

    // Redis — cache, queue, and event streams (ADR-5/ADR-6).
    REDIS_URL: z.string().default("redis://localhost:6379"),

    // Auth — access + refresh token signing secrets and lifetimes (ADR-4).
    JWT_SECRET: z.string().min(16).default(DEV_JWT_SECRET),
    JWT_TTL: z.string().default("15m"),
    JWT_REFRESH_SECRET: z.string().min(16).default(DEV_REFRESH_SECRET),
    JWT_REFRESH_TTL: z.string().default("30d"),

    // CORS — comma-separated allowlist of browser origins. Empty in dev reflects
    // the request origin; in production an explicit allowlist is required.
    CORS_ORIGINS: z
      .string()
      .default("")
      .transform((v) => v.split(",").map((o) => o.trim()).filter(Boolean)),

    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

    // Public base URL of the web app, used to build links inside emails.
    WEB_APP_URL: z.string().default("http://localhost:3001"),

    // Paystack (ADR-11). When the secret key is absent the stub provider handles
    // everything — dev/embedded mode keeps working with zero payment config.
    PAYSTACK_SECRET_KEY: z.string().optional(),
    PAYSTACK_BASE_URL: z.string().default("https://api.paystack.co"),

    // Object storage — Cloudflare R2 via its S3-compatible API (ADR-12). When
    // unset, photo uploads fall back to inline data URLs so dev needs no infra.
    R2_ACCOUNT_ID: z.string().optional(),
    R2_ACCESS_KEY_ID: z.string().optional(),
    R2_SECRET_ACCESS_KEY: z.string().optional(),
    R2_BUCKET: z.string().optional(),
    R2_PUBLIC_BASE_URL: z.string().optional(),
  })
  .superRefine((cfg, ctx) => {
    if (cfg.NODE_ENV !== "production") return;
    if (cfg.JWT_SECRET === DEV_JWT_SECRET) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["JWT_SECRET"], message: "JWT_SECRET must be set in production" });
    }
    if (cfg.JWT_REFRESH_SECRET === DEV_REFRESH_SECRET) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["JWT_REFRESH_SECRET"], message: "JWT_REFRESH_SECRET must be set in production" });
    }
    if (cfg.CORS_ORIGINS.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["CORS_ORIGINS"], message: "CORS_ORIGINS allowlist is required in production" });
    }
  });

export type Env = z.infer<typeof schema>;

export const env: Env = (() => {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment:\n", parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  return parsed.data;
})();
