-- Let a principal read their OWN person row before a tenant is chosen (login),
-- mirroring the memberships self-escape (ADR-4). Needed so /auth/login and
-- /auth/me can return the signed-in person's display name.
DROP POLICY IF EXISTS "persons_tenant" ON "persons";
CREATE POLICY "persons_tenant" ON "persons"
  USING (
    "school_id" = app_current_school()
    OR (app_org_wide() AND "org_id" = app_current_org())
    OR "account_id" = app_current_account()
  )
  WITH CHECK ("school_id" = app_current_school());
