-- Phase 1 — Step 3: deterministic lexical pre-pass for severity-1 signals
--
-- Detectors (bilingual English + Hindi/Hinglish):
--   WS41 — self-sourcing intent (critical)        client group
--   WS42 — self-sourcing + relationship carve-out client group
--   WS50 — CP/SP visible to client (critical)     client group
--   WS43 — empaneled vendor                       any group
--   WS14 — cancellation language (critical)       client group
--   WS15 — won't-pay / bulk payment (high)        client group
--
-- Detector script: scripts/whatsapp-scraper/lexical-flags.ts
--
-- Rollback:
--   begin;
--   drop policy if exists "auth users can read lexical_flags" on public.lexical_flags;
--   drop index if exists public.lexical_flags_unique_match;
--   drop index if exists public.lexical_flags_detected_idx;
--   drop index if exists public.lexical_flags_pid_signal_idx;
--   drop table if exists public.lexical_flags;
--   -- restore the original sop_flags view from 0010_phase7_cron.sql lines 169-198
--   commit;

begin;

create table public.lexical_flags (
  id                uuid primary key default gen_random_uuid(),
  pid               bigint not null references public.projects(pid) on delete cascade,
  signal_id         text not null check (signal_id in ('WS14','WS15','WS41','WS42','WS43','WS50')),
  severity          text not null check (severity in ('critical','high','medium','low','trend_watch')),
  source_group      text not null check (source_group in ('internal','client','venue')),
  matched_text      text not null,
  matched_pattern   text not null,
  message_id        uuid references public.signals(id) on delete cascade,
  message_sent_at   timestamptz,
  speaker_name      text,
  speaker_wa_id     text,
  detected_at       timestamptz not null default now()
);

create index lexical_flags_pid_signal_idx on public.lexical_flags(pid, signal_id);
create index lexical_flags_detected_idx on public.lexical_flags(detected_at desc);
create unique index lexical_flags_unique_match on public.lexical_flags(pid, signal_id, message_id);

alter table public.lexical_flags enable row level security;
create policy "auth users can read lexical_flags"
  on public.lexical_flags for select to authenticated using (true);

-- Extend the T0.5 sop_flags view to surface lexical flags from the last 14 days.
-- T1 reads sop_flags so any new lexical hit becomes brief-visible automatically.
create or replace view public.sop_flags as
  select p.pid,
         'collection_lag'::text as flag,
         'critical'::text as severity,
         'Collection ' || coalesce(p.collection_pct::text, 'null') ||
           '% at T' || coalesce(p.t_days::text, 'null') ||
           ', expected >' ||
           coalesce(public.expected_pct(p.t_days)::text, 'null') || '%' as detail
  from public.projects p
  where p.t_days between -90 and 180
    and p.collection_pct is not null
    and public.expected_pct(p.t_days) is not null
    and p.collection_pct < public.expected_pct(p.t_days)

  union all

  select p.pid,
         'planner_silent'::text as flag,
         case
           when p.t_days is not null and p.t_days < 30 then 'critical'
           else 'warning'
         end::text as severity,
         'Planner ' || coalesce(p.planner, 'unassigned') ||
           ' silent ' || public.days_since_last_planner_signal(p.pid)::text ||
           ' days' as detail
  from public.projects p
  where p.planner is not null
    and public.days_since_last_planner_signal(p.pid) > 3

  union all

  select lf.pid,
         lf.signal_id::text as flag,
         lf.severity::text as severity,
         '[' || lf.source_group || '/' || coalesce(lf.speaker_name, lf.speaker_wa_id, 'unknown') || '] "' ||
           substring(lf.matched_text, 1, 200) || '" (' ||
           to_char(lf.message_sent_at at time zone 'Asia/Kolkata', 'DD Mon HH24:MI') || ')' as detail
  from public.lexical_flags lf
  where lf.detected_at > now() - interval '14 days';

commit;
