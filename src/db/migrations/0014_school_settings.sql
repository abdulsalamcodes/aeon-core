-- School-level settings blob (grading scheme, billing plan, activation state).
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "settings" jsonb NOT NULL DEFAULT '{}';
