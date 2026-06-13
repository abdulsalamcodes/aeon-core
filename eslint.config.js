import tseslint from "typescript-eslint";

// Flat ESLint config. The key rule here is the ARCHITECTURE.md ADR-3 boundary:
// a module may import another module ONLY through its public barrel
// (src/modules/<name>/index.ts) — never reach into its internals or tables.
export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              // Block deep cross-module imports: .../modules/<x>/<not-index>
              group: ["**/modules/*/*", "!**/modules/*/index", "!**/modules/*/index.js"],
              message:
                "Import another module only via its public barrel (modules/<name>/index). Internals are private (ADR-3).",
            },
            {
              // Modules must not import the raw db client; go through tenant/services.
              group: ["**/db/client", "**/db/client.js"],
              message:
                "Modules must not touch the db client directly — use withTenant()/services (ADR-3).",
            },
          ],
        },
      ],
    },
  },
  {
    // Foundational layers legitimately own the db client:
    //  - db / tenant / events: infrastructure
    //  - auth + identity module: own the GLOBAL (non-tenant) accounts &
    //    memberships, which are looked up before any tenant is chosen (ADR-4).
    files: [
      "src/db/**/*.ts",
      "src/tenant/**/*.ts",
      "src/events/**/*.ts",
      "src/auth/**/*.ts",
      "src/modules/identity/**/*.ts",
    ],
    rules: { "no-restricted-imports": "off" },
  },
);
