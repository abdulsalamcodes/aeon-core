-- Platform super-admin flag on accounts (manages institutions across tenants).
ALTER TABLE "accounts" ADD COLUMN "is_super_admin" boolean NOT NULL DEFAULT false;
