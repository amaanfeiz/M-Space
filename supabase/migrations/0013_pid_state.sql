-- Phase 1 — Step 5: pid_state table
--
-- Tracks per-PID phase, runway position, and recovery / heightened-monitoring
-- state. Drives the brief's state-awareness layer (handoff conceptual shift #5).
--
-- Phase ladder:
--   sales_wip       — no planner assigned yet
--   onboarding      — first 25% of runway OR planning_status = 'Introduced'
--   active_planning — 25-50% of runway
--   mid_runway      — 50-75% of runway
--   final_quarter   — >=75% of runway
--   post_event      — event > 7 days ago OR planning_status = 'Concluded'
--   paused          — Event On Hold / Postponed / Non-responsive
--   cancelled       — planning_status = 'Cancelled'
--
-- runway_pct = elapsed / total planning runway, where:
--   start = first internal-group signal date (planning truly started)
--   end   = event_start_date
--
-- Recovery state and heightened_monitoring stay null until a state-machine
-- (Step 13) populates them.
--
-- Rollback:
--   begin;
--   drop policy if exists "auth users can read pid_state" on public.pid_state;
--   drop function if exists public.refresh_pid_states();
--   drop function if exists public.derive_pid_state(bigint);
--   drop table if exists public.pid_state;
--   commit;

begin;

create table public.pid_state (
  pid                              bigint primary key references public.projects(pid) on delete cascade,
  phase                            text not null check (phase in (
                                     'sales_wip','onboarding','active_planning','mid_runway',
                                     'final_quarter','post_event','paused','cancelled'
                                   )),
  runway_pct                       numeric,
  planning_started_at              timestamptz,
  recovery_entered_at              timestamptz,
  recovery_last_positive_marker_at timestamptz,
  recovery_sustained_positive      boolean not null default false,
  heightened_monitoring_until      timestamptz,
  updated_at                       timestamptz not null default now()
);

create index pid_state_phase_idx on public.pid_state(phase);
create index pid_state_recovery_idx on public.pid_state(recovery_entered_at)
  where recovery_entered_at is not null;

alter table public.pid_state enable row level security;
create policy "auth users can read pid_state"
  on public.pid_state for select to authenticated using (true);

-- Derive phase + runway_pct for a single PID.
create or replace function public.derive_pid_state(p_pid bigint)
returns table(phase text, runway_pct numeric, planning_started_at timestamptz)
language sql stable as $$
  with src as (
    select
      p.planner,
      p.event_start_date,
      p.planning_status,
      p.t_days,
      (select min(s.sent_at)
         from public.signals s
         where s.pid = p.pid and s.chat_type = 'internal') as first_internal_signal
    from public.projects p
    where p.pid = p_pid
  ),
  computed as (
    select
      src.*,
      case
        when src.first_internal_signal is not null
             and src.event_start_date is not null
             and src.event_start_date::timestamptz > src.first_internal_signal
        then
          extract(epoch from (now() - src.first_internal_signal)) /
          nullif(extract(epoch from (src.event_start_date::timestamptz - src.first_internal_signal)), 0) * 100
        else null
      end as raw_runway_pct
    from src
  )
  select
    case
      when planning_status = 'Cancelled' then 'cancelled'
      when planning_status = 'Concluded' or (t_days is not null and t_days < -7) then 'post_event'
      when planning_status in ('Event On Hold', 'Postponed', 'Non-responsive') then 'paused'
      when planner is null or planning_status in ('Sales WIP', 'Team to be Assigned') then 'sales_wip'
      when planning_status = 'Introduced' then 'onboarding'
      when raw_runway_pct is null then 'active_planning'
      when raw_runway_pct < 25 then 'onboarding'
      when raw_runway_pct < 50 then 'active_planning'
      when raw_runway_pct < 75 then 'mid_runway'
      else 'final_quarter'
    end::text as phase,
    case
      when raw_runway_pct is null then null
      when raw_runway_pct < 0 then 0
      when raw_runway_pct > 100 then 100
      else round(raw_runway_pct::numeric, 1)
    end as runway_pct,
    first_internal_signal as planning_started_at
  from computed;
$$;

-- Refresh all pid_state rows. Idempotent.
create or replace function public.refresh_pid_states()
returns int language plpgsql as $$
declare
  pid_row bigint;
  updated_count int := 0;
begin
  for pid_row in select pid from public.projects loop
    insert into public.pid_state (pid, phase, runway_pct, planning_started_at, updated_at)
    select pid_row, ds.phase, ds.runway_pct, ds.planning_started_at, now()
    from public.derive_pid_state(pid_row) ds
    on conflict (pid) do update set
      phase = excluded.phase,
      runway_pct = excluded.runway_pct,
      planning_started_at = excluded.planning_started_at,
      updated_at = now();
    updated_count := updated_count + 1;
  end loop;
  return updated_count;
end;
$$;

-- Initial population
select public.refresh_pid_states();

commit;
