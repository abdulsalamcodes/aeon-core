import { createApp } from '../src/app.js'
import { applyMigrations } from '../src/db/run-migrations.js'
import { seedProd } from '../src/db/seed-prod.js'

// Runs on every cold start — both are idempotent no-ops after first execution.
await applyMigrations()
await seedProd()

export default createApp()
