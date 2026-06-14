-- Academic calendar events + class timetables.

CREATE TABLE "calendar_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools" ("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "description" text,
  "start_date" date NOT NULL,
  "end_date" date NOT NULL,
  "type" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "calendar_school_start_idx" ON "calendar_events" ("school_id", "start_date");

CREATE TABLE "timetables" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools" ("id") ON DELETE CASCADE,
  "class_id" uuid NOT NULL REFERENCES "classes" ("id") ON DELETE CASCADE,
  "term_id" uuid NOT NULL REFERENCES "terms" ("id") ON DELETE CASCADE,
  "schedule" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "timetables_class_term_uq" ON "timetables" ("class_id", "term_id");

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['calendar_events','timetables']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (school_id = app_current_school()) WITH CHECK (school_id = app_current_school())',
      t || '_tenant', t
    );
  END LOOP;
END $$;
