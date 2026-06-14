-- Password-reset token + email-verification fields on accounts.
ALTER TABLE "accounts" ADD COLUMN "reset_token_hash" text;
ALTER TABLE "accounts" ADD COLUMN "reset_expires" timestamptz;
ALTER TABLE "accounts" ADD COLUMN "email_verified" boolean NOT NULL DEFAULT false;
