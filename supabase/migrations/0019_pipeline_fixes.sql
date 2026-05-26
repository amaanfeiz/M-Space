-- Pipeline fixes migration (Session 1)
-- Fixes: #4 planner_silent wa_id join, #5 clarification_evaluations constraints,
-- #12 cron_runs brief_date column

-- =====================================================================
-- #5: Allow match_method='manual' in clarification_evaluations
-- =====================================================================
alter table public.clarification_evaluations
  drop constraint if exists clarification_evaluations_match_method_check;

alter table public.clarification_evaluations
  add constraint clarification_evaluations_match_method_check
  check (match_method in ('deterministic', 'sonnet', 'none', 'manual'));

-- Make suggested_text nullable (manual "Send to Group" path has no suggestion)
alter table public.clarification_evaluations
  alter column suggested_text drop not null;

-- Add INSERT policy for authenticated users
create policy "auth users can insert clarification_evaluations"
  on public.clarification_evaluations for insert to authenticated
  with check (true);

-- =====================================================================
-- #4: Fix planner_silent to join on sender_wa_id, not just sender_name
-- =====================================================================
create or replace function public.days_since_last_planner_signal(p_pid bigint)
returns int language sql stable as $$
  select coalesce(
    (extract(epoch from (now() - max(s.sent_at))) / 86400)::int,
    9999
  )
  from public.signals s
  join public.signal_senders ss
    on ss.pid = s.pid
    and (
      (s.sender_wa_id is not null and ss.sender_wa_id = s.sender_wa_id)
      or (s.sender_wa_id is null and ss.sender_name = s.sender_name)
    )
  where s.pid = p_pid
    and ss.role = 'planner';
$$;

-- =====================================================================
-- #12: Add brief_date to cron_runs for duplicate detection
-- =====================================================================
alter table public.cron_runs
  add column if not exists brief_date date;
