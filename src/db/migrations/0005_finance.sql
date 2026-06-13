-- Phase 3: Finance + append-only ledger (ADR-8). Money is always
-- (amount_minor bigint, currency) — integer minor units, never floats.

CREATE TABLE "fee_structures" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools" ("id") ON DELETE CASCADE,
  "org_id" uuid NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
  "term_id" uuid NOT NULL REFERENCES "terms" ("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "amount_minor" bigint NOT NULL,
  "currency" text NOT NULL,
  "is_default" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "ledger_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools" ("id") ON DELETE CASCADE,
  "student_id" uuid NOT NULL REFERENCES "persons" ("id") ON DELETE CASCADE,
  "term_id" uuid NOT NULL REFERENCES "terms" ("id") ON DELETE CASCADE,
  "direction" text NOT NULL,
  "kind" text NOT NULL,
  "amount_minor" bigint NOT NULL,
  "currency" text NOT NULL,
  "reference" text,
  "idempotency_key" text,
  "meta" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
-- One ledger entry per (school, idempotency_key); NULLs are distinct so fees
-- (no key) are unaffected, but a replayed payment webhook can't double-credit.
CREATE UNIQUE INDEX "ledger_idempotency_uq" ON "ledger_entries" ("school_id", "idempotency_key");
CREATE INDEX "ledger_student_term_idx" ON "ledger_entries" ("student_id", "term_id");

-- RLS (ADR-2).
ALTER TABLE "fee_structures" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fee_structures" FORCE ROW LEVEL SECURITY;
CREATE POLICY "fee_structures_tenant" ON "fee_structures"
  USING (school_id = app_current_school() OR (app_org_wide() AND org_id = app_current_org()))
  WITH CHECK (school_id = app_current_school());

ALTER TABLE "ledger_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ledger_entries" FORCE ROW LEVEL SECURITY;
-- Append-only: no UPDATE/DELETE policy is granted, so even within a tenant the
-- ledger cannot be mutated — only inserted to and read.
CREATE POLICY "ledger_read" ON "ledger_entries"
  FOR SELECT USING (school_id = app_current_school());
CREATE POLICY "ledger_insert" ON "ledger_entries"
  FOR INSERT WITH CHECK (school_id = app_current_school());
