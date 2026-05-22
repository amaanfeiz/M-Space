-- Phase 1 — Step 12: T2.5 SOP critic output (Sonnet 4.6).
--
-- Runs after T1 on the subset of PIDs that have severity >= medium flags
-- in sop_flags (which now includes lexical_flags via migration 0012's view).
-- Loads brief + relevant SOPs + recent signals + answered clarifications,
-- emits structured critique with ladder-step recommendation.
--
-- Rollback:
--   begin;
--   drop policy if exists "auth users can read brief_sop_critique" on public.brief_sop_critique;
--   drop index if exists public.brief_sop_critique_unique;
--   drop index if exists public.brief_sop_critique_pid_idx;
--   drop table if exists public.brief_sop_critique;
--   commit;

begin;

create table public.brief_sop_critique (
  id                    uuid primary key default gen_random_uuid(),
  brief_id              uuid references public.briefs(id) on delete cascade,
  pid                   bigint not null references public.projects(pid),
  brief_date            date not null,
  violations            jsonb not null default '[]'::jsonb,
  exceptional_markers   jsonb not null default '[]'::jsonb,
  ladder_recommendation text check (ladder_recommendation in (
                          'monitor','internal_nudge','direct_call','tl_visible','reassign'
                        )),
  summary               text,
  model                 text not null,
  input_tokens          integer,
  output_tokens         integer,
  created_at            timestamptz not null default now()
);

create unique index brief_sop_critique_unique on public.brief_sop_critique(pid, brief_date);
create index brief_sop_critique_pid_idx on public.brief_sop_critique(pid, brief_date desc);

alter table public.brief_sop_critique enable row level security;

create policy "auth users can read brief_sop_critique"
  on public.brief_sop_critique for select to authenticated using (true);

commit;
