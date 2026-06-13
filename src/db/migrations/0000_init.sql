-- Phase 0 initial schema: org → school hierarchy, the subjects module, and the
-- transactional outbox. Mirrors src/db/schema/*.ts.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE "organizations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "organizations_slug_uq" ON "organizations" ("slug");

CREATE TABLE "schools" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organizations" ("id") ON DELETE RESTRICT,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "schools_slug_uq" ON "schools" ("slug");

CREATE TABLE "subjects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools" ("id") ON DELETE CASCADE,
  "org_id" uuid NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);
CREATE UNIQUE INDEX "subjects_school_name_uq" ON "subjects" ("school_id", "name");

CREATE TABLE "outbox_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL,
  "aggregate" text NOT NULL,
  "aggregate_id" uuid NOT NULL,
  "event_type" text NOT NULL,
  "payload" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "published_at" timestamptz
);
CREATE INDEX "outbox_unpublished_idx" ON "outbox_events" ("published_at", "created_at");
