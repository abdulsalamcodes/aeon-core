import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db, sql } from "./client.js";
import { logger } from "../config/logger.js";

/**
 * Applies all pending migrations (generated SQL + the hand-written RLS policy
 * migration) and exits. Run on deploy before the API/worker start.
 */
async function main() {
  logger.info("running migrations…");
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
  logger.info("migrations complete");
  await sql.end();
}

main().catch((err) => {
  logger.error({ err }, "migration failed");
  process.exit(1);
});
