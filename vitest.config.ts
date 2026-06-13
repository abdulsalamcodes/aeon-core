import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Run against an in-process Postgres (PGlite) — the core needs no external
    // infra to test end-to-end. CI also runs the same suite against real
    // Postgres (where RLS isolation is additionally enforced).
    env: {
      NODE_ENV: "test",
      EMBEDDED_DB: "true",
      JWT_SECRET: "test-secret-please-change-1234567890",
    },
    hookTimeout: 30000,
    testTimeout: 30000,
  },
});
