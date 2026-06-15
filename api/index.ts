/**
 * Vercel serverless entry point.
 * Imports the compiled Express app (dist/app.js) and exports it as the default
 * handler. Vercel's Node runtime manages the request/response lifecycle.
 *
 * Prerequisites:
 *   1. `npm run build` compiles src/ → dist/
 *   2. All env vars are set in the Vercel dashboard:
 *      - DATABASE_URL    — Neon pooled connection string
 *      - JWT_SECRET      — strong random secret (32+ chars)
 *      - NODE_ENV        — "production"
 *      - REDIS_URL       — optional; unused without the worker tier
 */
import { createApp } from "../dist/app.js";

const app = createApp();

export default app;
