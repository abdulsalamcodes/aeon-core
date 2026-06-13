import { applyMigrations } from "./run-migrations.js";
import { sql } from "./client.js";
import { logger } from "../config/logger.js";

/** Applies all pending migrations (schema + RLS) and exits. Run on deploy. */
async function main() {
  logger.info("running migrations…");
  await applyMigrations();
  logger.info("migrations complete");
  await sql.end();
}

main().catch((err) => {
  logger.error({ err }, "migration failed");
  process.exit(1);
});
