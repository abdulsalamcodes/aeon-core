-- Add optional contact fields to the schools table.
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "email" text;
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "phone" text;
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "address" text;
