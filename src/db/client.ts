import { drizzle as drizzlePg, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";
import { env } from "../config/env.js";
import * as schema from "./schema/index.js";

/**
 * The database handle. Two drivers behind one typed surface:
 *  - production/dev: pooled postgres-js (fronted by PgBouncer) — ADR-1/7.
 *  - EMBEDDED_DB=1: in-process PGlite (real Postgres in WASM), so the core
 *    runs and tests end-to-end with zero external infra. RLS DDL/policies are
 *    identical; note PGlite connects as a superuser, which bypasses RLS — so
 *    isolation is enforced by real Postgres in CI/prod, not the embedded run.
 *
 * The PGlite instance is structurally compatible with the postgres-js query
 * API, so we expose a single `PostgresJsDatabase` type and cast at the boundary.
 */
type Db = PostgresJsDatabase<typeof schema>;

let db: Db;
let sql: { end: () => Promise<void> };
/** Run a multi-statement SQL string (used by the migration runner). */
let execRaw: (text: string) => Promise<void>;

if (env.EMBEDDED_DB) {
  const pg = new PGlite(); // in-memory
  db = drizzlePglite(pg, { schema }) as unknown as Db;
  sql = { end: async () => pg.close() };
  execRaw = async (text) => {
    await pg.exec(text);
  };
} else {
  const client = postgres(env.DATABASE_URL, {
    max: env.NODE_ENV === "production" ? 20 : 5,
    prepare: false, // required behind PgBouncer transaction pooling
  });
  db = drizzlePg(client, { schema });
  sql = { end: () => client.end() };
  execRaw = async (text) => {
    await client.unsafe(text); // simple-query protocol: multiple statements OK
  };
}

export { db, sql, schema, execRaw };
export type { Db };
