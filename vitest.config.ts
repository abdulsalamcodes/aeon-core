import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Unit tests don't hit the DB (the postgres connection is lazy), but the
    // import chain loads env validation — give it valid defaults. The CI
    // integration job overrides these with real service URLs.
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgres://postgres:postgres@localhost:5432/schooler_core",
      REDIS_URL: "redis://localhost:6379",
    },
  },
});
