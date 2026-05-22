-- Drop the old unique constraint that only covered (pid, brief_date).
-- That caused catch-up and daily briefs generated on the same date to collide.
-- The new constraint includes is_catchup so both can coexist.

alter table public.briefs drop constraint if exists briefs_pid_brief_date_key;

alter table public.briefs
  add constraint briefs_pid_brief_date_is_catchup_key unique (pid, brief_date, is_catchup);
