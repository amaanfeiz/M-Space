-- Fix: partial unique index on wa_message_id doesn't satisfy ON CONFLICT (wa_message_id).
-- Replace with a full unique constraint. Postgres allows multiple NULLs in unique
-- constraints, so export rows (wa_message_id IS NULL) are unaffected.

drop index if exists public.signals_wa_message_id_uniq;

alter table public.signals
  add constraint signals_wa_message_id_key unique (wa_message_id);
