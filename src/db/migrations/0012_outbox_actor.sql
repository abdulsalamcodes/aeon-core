-- Audit attribution: record who triggered each domain event.
ALTER TABLE "outbox_events" ADD COLUMN "actor_id" uuid;
ALTER TABLE "outbox_events" ADD COLUMN "actor_name" text;
