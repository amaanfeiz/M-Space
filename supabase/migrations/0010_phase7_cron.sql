-- Phase 7 v1: cron-driven brief pipeline tiers (T0.5 / T1 / T1b / T2 / T3 / T4)
-- Reference: Obsidian decisions/2026-05-19-brief-analysis-tiers.md
--
-- Tables here back the overnight-batch pipeline that fires at 22:00 IST.
-- Edge Functions + Postgres completion-chain triggers come in later migrations
-- once the function URLs exist.

begin;

-- =====================================================================
-- Tables
-- =====================================================================

-- Implicit feedback: pairs of (suggested clarification) vs (actually sent).
-- T1b populates this. SQL pre-match fills `match_method='deterministic'` for
-- unambiguous cases; multi-candidate cases get `match_method='sonnet'`.
create table public.clarification_evaluations (
  id                  bigserial primary key,
  pid                 bigint not null references public.projects(pid),
  brief_date          date not null,
  suggested_text      text not null,
  actual_sent         text,
  matched_signal_id   uuid references public.signals(id),
  match_confidence    text check (match_confidence in ('high','medium','low','none')),
  match_method        text check (match_method in ('deterministic','sonnet','none')),
  match_window_hours  integer,
  diff_summary        text,
  matched_at          timestamptz not null default now(),
  unique (pid, brief_date)
);

create index clarification_evaluations_pid_date_idx
  on public.clarification_evaluations(pid, brief_date desc);

-- T2 output: reference-compressed portfolio context handed to Opus (T3).
create table public.portfolio_context (
  context_date    date primary key,
  content_json    jsonb not null,
  input_tokens    integer,
  output_tokens   integer,
  built_at        timestamptz not null default now()
);

-- T3 output: daily Opus strategic portfolio brief (compact JSON, ~2-3K out).
create table public.portfolio_briefs (
  brief_date      date primary key,
  brief_json      jsonb not null,
  input_tokens    integer,
  output_tokens   integer,
  generated_at    timestamptz not null default now()
);

-- Sunday digest weekly read (replaces daily narrative).
create table public.weekly_narratives (
  week_start      date primary key,
  narrative_text  text not null,
  digest_json     jsonb,
  generated_at    timestamptz not null default now()
);

-- SYSTEM_PROMPT versioning. Only one row may have is_active = true at a time.
create table public.system_prompts (
  version         integer primary key,
  prompt_text     text not null,
  rationale       text,
  created_at      timestamptz not null default now(),
  is_active       boolean not null default false,
  approved_by     text,
  approved_at     timestamptz
);

create unique index system_prompts_only_one_active
  on public.system_prompts ((1)) where is_active = true;

-- T4 output: proposed SYSTEM_PROMPT edits.
create table public.prompt_proposals (
  id              bigserial primary key,
  proposed_at     timestamptz not null default now(),
  current_version integer references public.system_prompts(version),
  proposed_text   text not null,
  diff_summary    text,
  status          text not null default 'pending'
                    check (status in ('pending','approved','rejected')),
  decided_at      timestamptz,
  decision_note   text
);

-- T4 output: proposed new/edited SOPs. Empty until Phase 7.5 populates it.
create table public.sop_proposals (
  id                  bigserial primary key,
  proposed_at         timestamptz not null default now(),
  proposed_sop        jsonb not null,
  rationale           text,
  evidence_brief_ids  uuid[],
  status              text not null default 'pending'
                        check (status in ('pending','approved','rejected')),
  decided_at          timestamptz,
  decision_note       text
);

-- Incremental scraper cursors. Empty on first run → scraper falls back to
-- full 2000-msg pull, then records the cursor for subsequent runs.
create table public.chat_cursors (
  chat_group_id         text primary key,
  last_seen_message_id  text,
  last_seen_at          timestamptz,
  last_scrape_at        timestamptz,
  full_reconcile_at     timestamptz
);

-- Per-tier batch audit. Per-call ledger (ai_runs) is deferred to Phase 7.5.
create table public.cron_runs (
  id              bigserial primary key,
  tier            text not null,
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  status          text not null
                    check (status in ('running','completed','partial','failed','escalated')),
  rows_written    integer,
  cost_inr        numeric(10,2),
  batch_id        text,
  error_text      text
);

create index cron_runs_tier_started_idx
  on public.cron_runs(tier, started_at desc);

-- =====================================================================
-- Helper functions for the T0.5 sop_flags view
-- =====================================================================

-- Expected collection % at a given T-day. v1 is tier-agnostic; Phase 7.2
-- will replace this with a package_tier-aware curve once tiers are tracked.
create or replace function public.expected_pct(t_days int)
returns numeric language sql immutable as $$
  select case
    when t_days is null then null
    when t_days <  -60  then 0
    when t_days <  -30  then 25
    when t_days <    0  then 50
    when t_days <   30  then 75
    when t_days <   90  then 90
    else                     100
  end;
$$;

-- Days since the last signal from a planner-role sender on this PID.
-- Returns 9999 (sentinel "never") if no planner signals exist yet so the
-- planner_silent flag still fires for newly-assigned silent planners.
create or replace function public.days_since_last_planner_signal(p_pid bigint)
returns int language sql stable as $$
  select coalesce(
    (extract(epoch from (now() - max(s.sent_at))) / 86400)::int,
    9999
  )
  from public.signals s
  join public.signal_senders ss
    on ss.pid = s.pid and ss.sender_name = s.sender_name
  where s.pid = p_pid
    and ss.role = 'planner';
$$;

-- =====================================================================
-- T0.5 deterministic SOP-violation view
-- =====================================================================
-- v1 captures the two flags from the locked decision doc. Add more flags
-- here as SOPs land in Phase 7.2 / 7.5.

create or replace view public.sop_flags as
  -- Collection lagging the expected payment curve.
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

  -- Planner silent on a PID where a planner is assigned.
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
    and public.days_since_last_planner_signal(p.pid) > 3;

-- =====================================================================
-- RLS
-- =====================================================================
-- Phase 1: Amaan is the only logged-in user, so authenticated-read is fine.
-- Writes happen via Edge Functions running with the service role, which
-- bypasses RLS. chat_cursors stays internal — no read policy needed.

alter table public.clarification_evaluations enable row level security;
alter table public.portfolio_context        enable row level security;
alter table public.portfolio_briefs         enable row level security;
alter table public.weekly_narratives        enable row level security;
alter table public.system_prompts           enable row level security;
alter table public.prompt_proposals         enable row level security;
alter table public.sop_proposals            enable row level security;
alter table public.chat_cursors             enable row level security;
alter table public.cron_runs                enable row level security;

create policy "auth users can read clarification_evaluations"
  on public.clarification_evaluations for select to authenticated using (true);

create policy "auth users can read portfolio_context"
  on public.portfolio_context for select to authenticated using (true);

create policy "auth users can read portfolio_briefs"
  on public.portfolio_briefs for select to authenticated using (true);

create policy "auth users can read weekly_narratives"
  on public.weekly_narratives for select to authenticated using (true);

create policy "auth users can read system_prompts"
  on public.system_prompts for select to authenticated using (true);

create policy "auth users can read prompt_proposals"
  on public.prompt_proposals for select to authenticated using (true);

create policy "auth users can read sop_proposals"
  on public.sop_proposals for select to authenticated using (true);

create policy "auth users can read cron_runs"
  on public.cron_runs for select to authenticated using (true);

commit;
