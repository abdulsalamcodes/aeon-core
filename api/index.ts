import { createApp } from '../src/app.js'
import { applyMigrations } from '../src/db/run-migrations.js'

// Run on every cold start — idempotent, skips already-applied migrations.
await applyMigrations()

export default createApp()
