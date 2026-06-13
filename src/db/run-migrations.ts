import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { sql as raw } from "drizzle-orm";
import { db, execRaw } from "./client.js";
import { logger } from "../config/logger.js";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "migrations");

interface JournalEntry {
  idx: number;
  tag: string;
}

/**
 * Driver-agnostic migration runner. Reads the journal, runs each migration's
 * SQL via the driver's multi-statement path (PGlite `.exec` / postgres-js
 * simple query), and records applied tags so it's idempotent. Works on both
 * embedded PGlite and real Postgres without per-statement breakpoints.
 */
export async function applyMigrations(): Promise<void> {
  const journal = JSON.parse(readFileSync(join(migrationsDir, "meta", "_journal.json"), "utf8")) as {
    entries: JournalEntry[];
  };

  await execRaw(
    `CREATE TABLE IF NOT EXISTS "_migrations" ("tag" text PRIMARY KEY, "applied_at" timestamptz NOT NULL DEFAULT now())`,
  );
  const appliedRes = await db.execute(raw`select tag from "_migrations"`);
  // postgres-js returns an array; pglite returns { rows: [...] }.
  const appliedRows = (Array.isArray(appliedRes) ? appliedRes : (appliedRes as { rows?: unknown[] }).rows ?? []) as {
    tag: string;
  }[];
  const applied = new Set(appliedRows.map((r) => r.tag));

  const ordered = [...journal.entries].sort((a, b) => a.idx - b.idx);
  for (const entry of ordered) {
    if (applied.has(entry.tag)) continue;
    const file = join(migrationsDir, `${entry.tag}.sql`);
    await execRaw(readFileSync(file, "utf8"));
    await db.execute(raw`insert into "_migrations" (tag) values (${entry.tag})`);
    logger.info({ tag: entry.tag }, "migration applied");
  }
}
