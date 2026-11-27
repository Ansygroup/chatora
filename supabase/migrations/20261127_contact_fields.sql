-- Chatora Phase 2 item 1: custom fields on contacts (tags already exist).
-- Fields are per-contact key/value pairs, usable as message tokens and in triggers.

BEGIN;

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS fields jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMIT;
