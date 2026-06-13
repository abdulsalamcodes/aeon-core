-- Row-Level Security (ADR-2): tenant isolation enforced IN THE DATABASE.
--
-- The app sets two transaction-local GUCs per request (see tenant/context.ts):
--   app.current_school  — the active school id
--   app.org_wide        — 'on' for org-scoped principals (e.g. a director)
--   app.current_org     — the active org id (used when org_wide)
--
-- A query with no tenant context sees ZERO rows. A query that forgets its WHERE
-- still cannot leak across schools — the policy filters it. This removes the
-- whole class of "forgot the institution filter" bugs.

-- Helper: current school id from the session GUC (NULL when unset).
CREATE OR REPLACE FUNCTION app_current_school() RETURNS uuid
  LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('app.current_school', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION app_current_org() RETURNS uuid
  LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('app.current_org', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION app_org_wide() RETURNS boolean
  LANGUAGE sql STABLE AS $$
    SELECT current_setting('app.org_wide', true) = 'on'
$$;

-- ── subjects ────────────────────────────────────────────────────────────────
ALTER TABLE "subjects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subjects" FORCE ROW LEVEL SECURITY;

CREATE POLICY "subjects_tenant_isolation" ON "subjects"
  USING (
    "school_id" = app_current_school()
    OR (app_org_wide() AND "org_id" = app_current_org())
  )
  WITH CHECK (
    "school_id" = app_current_school()
  );

-- ── outbox_events ───────────────────────────────────────────────────────────
-- Note: the relay reads the outbox OUTSIDE tenant context (it ships everyone's
-- events), so it connects as a role that bypasses RLS. App writers are scoped.
ALTER TABLE "outbox_events" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "outbox_tenant_write" ON "outbox_events"
  FOR INSERT
  WITH CHECK ("school_id" = app_current_school());

CREATE POLICY "outbox_tenant_read" ON "outbox_events"
  FOR SELECT
  USING ("school_id" = app_current_school());

-- The relay/worker connects as a BYPASSRLS role (e.g. created via:
--   CREATE ROLE schooler_relay LOGIN BYPASSRLS;
-- ) so it can drain the outbox across all tenants.
