import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { applyMigrations } from "./db/run-migrations.js";
import { seedDev } from "./db/seed-dev.js";

async function main() {
  // Embedded mode uses an in-memory Postgres that's empty on boot, so migrate
  // and seed it automatically — `EMBEDDED_DB=1 npm run dev` is a working API
  // (login: admin@demo.aeon / Demo-Pass-123), no external infra.
  if (env.EMBEDDED_DB) {
    await applyMigrations();
    await seedDev();
    logger.info("embedded database migrated + seeded");
  }

  const app = createApp();
  app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV, embedded: env.EMBEDDED_DB }, "Aeon core API listening");
  });
}

main().catch((err) => {
  logger.error({ err }, "failed to start");
  process.exit(1);
});
