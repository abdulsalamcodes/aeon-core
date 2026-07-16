-- Email verification tokens for self-service signup.
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "verify_token_hash" text;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "verify_expires" timestamptz;

-- Accounts created before verification existed were already usable — keep them
-- signed-in-able so the assisted/enterprise flow is unaffected.
UPDATE "accounts" SET "email_verified" = true WHERE "email_verified" = false;
