import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit config — schema is the source of truth; `db:generate` diffs it
 * into reviewable SQL migrations under src/db/migrations (ADR-1).
 */
export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://localhost:5432/schooler",
  },
  strict: true,
  verbose: true,
});
