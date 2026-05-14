-- Stores generated AI briefs per PID per day.
-- brief_json follows the 7-section schema from generate-brief.ts.

create table public.briefs (
  id           uuid        primary key default gen_random_uuid(),
  pid          bigint      not null references public.projects(pid),
  brief_date   date        not null,
  generated_at timestamptz not null default now(),
  model        text        not null,
  input_tokens integer,
  output_tokens integer,
  is_catchup   boolean     not null default false,
  brief_json   jsonb       not null,
  created_at   timestamptz not null default now(),
  unique (pid, brief_date)
);

create index briefs_pid_date_idx on public.briefs(pid, brief_date desc);

alter table public.briefs enable row level security;

create policy "auth users can read briefs"
  on public.briefs for select
  to authenticated
  using (true);
