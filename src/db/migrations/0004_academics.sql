-- Phase 2: People + Academics. Terms, classes, enrollments, guardianships,
-- attendance, grades. Mirrors src/db/schema/*.

CREATE TABLE "terms" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools" ("id") ON DELETE CASCADE,
  "org_id" uuid NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "start_date" date,
  "end_date" date,
  "is_current" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "classes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools" ("id") ON DELETE CASCADE,
  "org_id" uuid NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "class_teacher_id" uuid REFERENCES "persons" ("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);
CREATE UNIQUE INDEX "classes_school_name_uq" ON "classes" ("school_id", "name");

CREATE TABLE "enrollments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools" ("id") ON DELETE CASCADE,
  "org_id" uuid NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
  "student_id" uuid NOT NULL REFERENCES "persons" ("id") ON DELETE CASCADE,
  "class_id" uuid NOT NULL REFERENCES "classes" ("id") ON DELETE RESTRICT,
  "term_id" uuid NOT NULL REFERENCES "terms" ("id") ON DELETE RESTRICT,
  "enrolled_at" timestamptz NOT NULL DEFAULT now(),
  "unenrolled_at" timestamptz
);
CREATE UNIQUE INDEX "enrollments_student_term_uq" ON "enrollments" ("student_id", "term_id");

CREATE TABLE "guardianships" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools" ("id") ON DELETE CASCADE,
  "guardian_id" uuid NOT NULL REFERENCES "persons" ("id") ON DELETE CASCADE,
  "student_id" uuid NOT NULL REFERENCES "persons" ("id") ON DELETE CASCADE,
  "relationship" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "guardianships_pair_uq" ON "guardianships" ("guardian_id", "student_id");

CREATE TABLE "attendance" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools" ("id") ON DELETE CASCADE,
  "student_id" uuid NOT NULL REFERENCES "persons" ("id") ON DELETE CASCADE,
  "class_id" uuid NOT NULL REFERENCES "classes" ("id") ON DELETE CASCADE,
  "term_id" uuid NOT NULL REFERENCES "terms" ("id") ON DELETE CASCADE,
  "date" date NOT NULL,
  "status" text NOT NULL DEFAULT 'unmarked',
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "attendance_student_class_date_uq" ON "attendance" ("student_id", "class_id", "date");

CREATE TABLE "grades" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools" ("id") ON DELETE CASCADE,
  "student_id" uuid NOT NULL REFERENCES "persons" ("id") ON DELETE CASCADE,
  "subject_id" uuid NOT NULL REFERENCES "subjects" ("id") ON DELETE CASCADE,
  "term_id" uuid NOT NULL REFERENCES "terms" ("id") ON DELETE CASCADE,
  "ca_score" integer NOT NULL DEFAULT 0,
  "exam_score" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "grades_student_subject_term_uq" ON "grades" ("student_id", "subject_id", "term_id");

-- ── RLS: every Phase 2 table is tenant-scoped by school (ADR-2) ───────────────
DO $$
DECLARE t text;
BEGIN
  -- Tables carrying org_id get the org-wide read clause (directors span the org).
  FOREACH t IN ARRAY ARRAY['terms','classes','enrollments']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (school_id = app_current_school() OR (app_org_wide() AND org_id = app_current_org())) WITH CHECK (school_id = app_current_school())',
      t || '_tenant', t
    );
  END LOOP;

  -- School-only tables (no org_id column): straight school scoping.
  FOREACH t IN ARRAY ARRAY['guardianships','attendance','grades']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (school_id = app_current_school()) WITH CHECK (school_id = app_current_school())',
      t || '_tenant', t
    );
  END LOOP;
END $$;
