import { describe, it, expect } from "vitest";
import { createSubjectInput } from "./subjects.schema.js";

/**
 * Pure unit tests (no DB). The end-to-end RLS + outbox behaviour is exercised
 * by the CI integration job, which spins up Postgres, runs migrations, and
 * asserts:
 *   - a query without tenant context returns zero rows (RLS),
 *   - creating a subject also writes exactly one outbox row in the same txn,
 *   - school A cannot read school B's subjects.
 */
describe("createSubjectInput", () => {
  it("accepts a valid name", () => {
    expect(createSubjectInput.safeParse({ name: "Mathematics" }).success).toBe(true);
  });

  it("rejects empty / whitespace names", () => {
    expect(createSubjectInput.safeParse({ name: "" }).success).toBe(false);
    expect(createSubjectInput.safeParse({ name: "   " }).success).toBe(false);
  });

  it("trims and bounds length", () => {
    const parsed = createSubjectInput.parse({ name: "  English  " });
    expect(parsed.name).toBe("English");
    expect(createSubjectInput.safeParse({ name: "x".repeat(200) }).success).toBe(false);
  });
});
