-- Phase 1 — Step 7: AI clarification Q/A persistence
--
-- T1 emits ai_clarification[] per brief (things the model is uncertain about).
-- Each item becomes a row here. Amaan answers via /api/clarification-answer
-- and the answer persists as authoritative context for future T1 runs.
--
-- Rollback:
--   begin;
--   drop policy if exists "auth users can update brief_clarifications" on public.brief_clarifications;
--   drop policy if exists "auth users can read brief_clarifications" on public.brief_clarifications;
--   drop index if exists public.brief_clarifications_unique;
--   drop index if exists public.brief_clarifications_pending_idx;
--   drop index if exists public.brief_clarifications_pid_date_idx;
--   drop table if exists public.brief_clarifications;
--   commit;

begin;

create table public.brief_clarifications (
  id                    uuid primary key default gen_random_uuid(),
  pid                   bigint not null references public.projects(pid) on delete cascade,
  brief_id              uuid references public.briefs(id) on delete set null,
  brief_date            date not null,
  question              text not null,
  ai_uncertainty_reason text,
  category              text check (category in ('sentiment','payment','team','vendor','other')),
  amaan_answer          text,
  answered_at           timestamptz,
  applies_until         timestamptz,
  created_at            timestamptz not null default now()
);

create index brief_clarifications_pid_date_idx
  on public.brief_clarifications(pid, brief_date desc);

create index brief_clarifications_pending_idx
  on public.brief_clarifications(pid)
  where amaan_answer is null;

-- Avoid duplicates when the same brief is regenerated. Keyed on question hash.
create unique index brief_clarifications_unique
  on public.brief_clarifications(pid, brief_date, md5(question));

alter table public.brief_clarifications enable row level security;

create policy "auth users can read brief_clarifications"
  on public.brief_clarifications for select to authenticated using (true);

create policy "auth users can update brief_clarifications"
  on public.brief_clarifications for update to authenticated using (true) with check (true);

commit;
