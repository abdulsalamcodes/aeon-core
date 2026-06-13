-- Phase 4: Notifications + Workflow engine.

CREATE TABLE "notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools" ("id") ON DELETE CASCADE,
  "channel" text NOT NULL,
  "to_address" text NOT NULL,
  "template" text NOT NULL,
  "body" text NOT NULL,
  "status" text NOT NULL DEFAULT 'queued',
  "meta" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "notifications_school_idx" ON "notifications" ("school_id", "created_at");

CREATE TABLE "workflow_definitions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools" ("id") ON DELETE CASCADE,
  "key" text NOT NULL,
  "steps" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "wf_def_key_uq" ON "workflow_definitions" ("school_id", "key");

CREATE TABLE "workflow_instances" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools" ("id") ON DELETE CASCADE,
  "definition_id" uuid NOT NULL REFERENCES "workflow_definitions" ("id") ON DELETE RESTRICT,
  "subject_ref" text NOT NULL,
  "state" text NOT NULL DEFAULT 'pending',
  "current_step" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "workflow_tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools" ("id") ON DELETE CASCADE,
  "instance_id" uuid NOT NULL REFERENCES "workflow_instances" ("id") ON DELETE CASCADE,
  "step_index" integer NOT NULL,
  "approver_role" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "decided_by" uuid,
  "decided_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- RLS (ADR-2): straight school scoping for all Phase 4 tables.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['notifications','workflow_definitions','workflow_instances','workflow_tasks']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (school_id = app_current_school()) WITH CHECK (school_id = app_current_school())',
      t || '_tenant', t
    );
  END LOOP;
END $$;
