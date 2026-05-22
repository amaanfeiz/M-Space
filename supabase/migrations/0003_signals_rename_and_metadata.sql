-- Rename whatsapp_messages -> signals and prepare for multi-source ingest
-- (WhatsApp scraper, .txt exports, and future Gmail/Drive/Calendar connectors).
--
-- Notes:
--   - sent_at column kept (locked plan referenced "message_timestamp"; preserving
--     existing column name avoids a scraper rewrite for no semantic gain).
--   - Cross-source dedupe key uses a minute-precision generated column because
--     .txt exports timestamp to the minute while the scraper has full-second
--     precision. The generated column converts to UTC (timestamp without tz) so
--     the expression stays IMMUTABLE — required for unique-index expressions.
--     A same-sender-same-minute identical-body collision is treated as one row.

begin;

-- 1. Rename table
alter table public.whatsapp_messages rename to signals;

-- 2. Rename group_type -> chat_type, allow null (non-WhatsApp sources won't have one)
alter table public.signals rename column group_type to chat_type;
alter table public.signals alter column chat_type drop not null;

-- Old check constraint references the old column name; replace it.
alter table public.signals drop constraint if exists whatsapp_messages_group_type_check;
alter table public.signals
  add constraint signals_chat_type_check
  check (chat_type is null or chat_type in ('client', 'internal'));

-- 3. source_type enum (whatsapp now; gemini_note/email/calendar_event later)
create type public.signal_source_type as enum (
  'whatsapp',
  'gemini_note',
  'email',
  'calendar_event'
);

alter table public.signals
  add column source_type public.signal_source_type not null default 'whatsapp';

-- 4. source provenance ('export' = historical .txt, 'scraper' = live wa scrape,
--    'connector' = future Gmail/Drive/Calendar). Default 'scraper' so existing
--    rows (which all came from the scraper) backfill correctly.
alter table public.signals
  add column source text not null default 'scraper'
  check (source in ('export', 'scraper', 'connector'));

-- 5. Body hash (generated, stored) for cross-source dedupe
alter table public.signals
  add column body_hash text generated always as
  (encode(sha256(coalesce(body, '')::bytea), 'hex')) stored;

-- 6. wa_message_id is scraper-only — relax NOT NULL + drop the table-wide unique;
--    re-add a partial unique index so scraper rows still can't double-insert.
alter table public.signals alter column wa_message_id drop not null;
alter table public.signals drop constraint if exists whatsapp_messages_wa_message_id_key;
create unique index signals_wa_message_id_uniq
  on public.signals(wa_message_id)
  where wa_message_id is not null;

-- 7. Minute-precision sent_at as a stored generated column (UTC).
--    AT TIME ZONE 'UTC' returns a timestamp-without-tz; date_trunc on that is
--    IMMUTABLE, so it can back a unique index.
alter table public.signals
  add column sent_at_minute timestamp generated always as
  (date_trunc('minute', (sent_at at time zone 'UTC'))) stored;

-- Cross-source dedupe key
create unique index signals_dedupe_idx
  on public.signals (pid, sent_at_minute, sender_name, body_hash);

-- 8. Rename existing indexes for clarity
alter index whatsapp_messages_pid_idx     rename to signals_pid_idx;
alter index whatsapp_messages_sent_at_idx rename to signals_sent_at_idx;

-- 9. RLS policy was named after the old table; recreate
drop policy if exists "auth users can read whatsapp_messages" on public.signals;
create policy "auth users can read signals"
  on public.signals for select
  to authenticated
  using (true);

-- 10. FK constraint name
alter table public.signals
  rename constraint whatsapp_messages_pid_fkey to signals_pid_fkey;

commit;
