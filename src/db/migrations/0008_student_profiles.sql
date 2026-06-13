-- Student-specific profile hanging off a person (parallel to staff_profiles).

CREATE TABLE "student_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools" ("id") ON DELETE CASCADE,
  "person_id" uuid NOT NULL REFERENCES "persons" ("id") ON DELETE CASCADE,
  "student_number" text,
  "gender" text,
  "guardian_name" text,
  "guardian_phone" text,
  "guardian_email" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "student_profiles_person_uq" ON "student_profiles" ("person_id");
CREATE UNIQUE INDEX "student_profiles_number_uq" ON "student_profiles" ("school_id", "student_number");

ALTER TABLE "student_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_profiles" FORCE ROW LEVEL SECURITY;
CREATE POLICY "student_profiles_tenant" ON "student_profiles"
  USING ("school_id" = app_current_school())
  WITH CHECK ("school_id" = app_current_school());
