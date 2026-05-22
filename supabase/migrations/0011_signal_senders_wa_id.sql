-- Add sender_wa_id to signal_senders so internal-group messages (sender_name=null)
-- can be resolved by wa_id. The PK (pid, sender_name) stays unchanged; wa_id-only
-- entries are stored with sender_name = sender_wa_id (the raw wa_id string).

alter table public.signal_senders add column sender_wa_id text;

-- Unique index for wa_id-based lookup (used by loadSenders in generate-brief.ts)
create unique index signal_senders_pid_wa_id_idx
  on public.signal_senders(pid, sender_wa_id)
  where sender_wa_id is not null;
