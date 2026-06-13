-- Phase 1: Identity + Org graph. Accounts (global login), roles, and the
-- tenant-owned persons / memberships / staff_profiles. Mirrors src/db/schema/*.

-- Global login identity (not tenant-owned).
CREATE TABLE "accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" text NOT NULL,
  "phone" text,
  "password_hash" text NOT NULL,
  "status" text NOT NULL DEFAULT 'active',
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "accounts_email_uq" ON "accounts" ("email");

-- Roles: system roles have school_id NULL; schools may add their own.
CREATE TABLE "roles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid REFERENCES "schools" ("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "permissions" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "is_system" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "roles_name_school_uq" ON "roles" ("name", "school_id");

-- Person = the human + PII (tenant-owned).
CREATE TABLE "persons" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools" ("id") ON DELETE CASCADE,
  "org_id" uuid NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
  "account_id" uuid REFERENCES "accounts" ("id") ON DELETE SET NULL,
  "first_name" text NOT NULL,
  "last_name" text NOT NULL,
  "dob" date,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);

-- Membership = account/person × school × role × scope (tenant-owned).
CREATE TABLE "memberships" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools" ("id") ON DELETE CASCADE,
  "org_id" uuid NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
  "account_id" uuid NOT NULL REFERENCES "accounts" ("id") ON DELETE CASCADE,
  "person_id" uuid NOT NULL REFERENCES "persons" ("id") ON DELETE CASCADE,
  "role_id" uuid NOT NULL REFERENCES "roles" ("id") ON DELETE RESTRICT,
  "role_name" text NOT NULL,
  "status" text NOT NULL DEFAULT 'active',
  "scope" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "org_wide" text NOT NULL DEFAULT 'off',
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "memberships_account_idx" ON "memberships" ("account_id");
CREATE INDEX "memberships_school_idx" ON "memberships" ("school_id");

-- Staff HR/employment record (tenant-owned).
CREATE TABLE "staff_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools" ("id") ON DELETE CASCADE,
  "person_id" uuid NOT NULL REFERENCES "persons" ("id") ON DELETE CASCADE,
  "employee_no" text,
  "department" text,
  "title" text,
  "hired_at" date,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "staff_profiles_person_uq" ON "staff_profiles" ("person_id");
