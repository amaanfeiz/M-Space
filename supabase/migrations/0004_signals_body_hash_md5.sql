-- Fix the signals.body_hash generated column.
--
-- 0003 used encode(sha256(coalesce(body, '')::bytea), 'hex'). The implicit
-- text->bytea cast invokes bytea_in, which interprets backslash-escape
-- sequences and raises "invalid input syntax for type bytea" on real
-- WhatsApp message content (some messages contain literal backslashes).
--
-- md5(text) is IMMUTABLE, takes text directly, never raises, and at our
-- scale collision risk is negligible — fine for a dedupe key.

alter table public.signals drop column body_hash;

alter table public.signals
  add column body_hash text generated always as
  (md5(coalesce(body, ''))) stored;

create unique index signals_dedupe_idx
  on public.signals (pid, sent_at_minute, sender_name, body_hash);
