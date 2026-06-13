-- RLS for the identity graph (ADR-2/ADR-4).
--
-- accounts: GLOBAL login identity — no RLS (lookup happens before a tenant is
--   chosen). Protected at the application/role layer instead.
-- roles: readable when system (school_id IS NULL) or owned by the current
--   school. Writable only within the current school.
-- persons / memberships / staff_profiles: tenant-scoped like everything else,
--   PLUS a login escape so a principal can read their OWN memberships across
--   schools before picking one.

CREATE OR REPLACE FUNCTION app_current_account() RETURNS uuid
  LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('app.current_account', true), '')::uuid
$$;

-- ── roles ────────────────────────────────────────────────────────────────────
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles_read" ON "roles"
  FOR SELECT
  USING ("school_id" IS NULL OR "school_id" = app_current_school());
CREATE POLICY "roles_write" ON "roles"
  FOR ALL
  USING ("school_id" = app_current_school())
  WITH CHECK ("school_id" = app_current_school());

-- ── persons ──────────────────────────────────────────────────────────────────
ALTER TABLE "persons" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "persons" FORCE ROW LEVEL SECURITY;
CREATE POLICY "persons_tenant" ON "persons"
  USING (
    "school_id" = app_current_school()
    OR (app_org_wide() AND "org_id" = app_current_org())
  )
  WITH CHECK ("school_id" = app_current_school());

-- ── memberships ──────────────────────────────────────────────────────────────
ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "memberships" FORCE ROW LEVEL SECURITY;
CREATE POLICY "memberships_tenant_or_self" ON "memberships"
  FOR SELECT
  USING (
    "school_id" = app_current_school()
    OR (app_org_wide() AND "org_id" = app_current_org())
    -- login escape: you may always read YOUR OWN memberships across schools
    OR "account_id" = app_current_account()
  );
CREATE POLICY "memberships_tenant_write" ON "memberships"
  FOR ALL
  USING ("school_id" = app_current_school())
  WITH CHECK ("school_id" = app_current_school());

-- ── staff_profiles ───────────────────────────────────────────────────────────
ALTER TABLE "staff_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "staff_profiles" FORCE ROW LEVEL SECURITY;
CREATE POLICY "staff_profiles_tenant" ON "staff_profiles"
  USING (
    "school_id" = app_current_school()
    OR (app_org_wide() AND EXISTS (
      SELECT 1 FROM "persons" p
      WHERE p.id = "staff_profiles"."person_id" AND p.org_id = app_current_org()
    ))
  )
  WITH CHECK ("school_id" = app_current_school());
