import { z } from "zod";

/**
 * Centralized, validated environment. Fails fast on boot if misconfigured.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(8080),

  // Postgres — the system of record (ADR-1). Use a pooled connection (PgBouncer) in prod.
  DATABASE_URL: z.string().url().or(z.string().startsWith("postgres")),

  // Redis — cache, queue, and event streams (ADR-5/ADR-6).
  REDIS_URL: z.string().default("redis://localhost:6379"),

  // Auth — access-token signing secret + lifetime (ADR-4).
  JWT_SECRET: z.string().min(16).default("dev-only-insecure-secret-change-me"),
  JWT_TTL: z.string().default("15m"),

  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
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
