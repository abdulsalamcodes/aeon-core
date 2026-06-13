import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../config/env.js";
import * as schema from "./schema/index.js";

/**
 * Single pooled postgres-js connection. In production this points at PgBouncer
 * (transaction pooling) so the API tier scales without exhausting Postgres
 * connections (ADR-1/ADR-7).
 */
export const sql = postgres(env.DATABASE_URL, {
  max: env.NODE_ENV === "production" ? 20 : 5,
  prepare: false, // required when fronted by PgBouncer in transaction mode
});

export const db = drizzle(sql, { schema });

export type Db = typeof db;
export { schema };
