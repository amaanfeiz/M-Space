-- Projects table: merged view of Live Tracker + Risk Tracker
create table public.projects (
  pid bigint primary key,

  -- Live Tracker fields
  cx_name text,
  cx_name_studio text,
  status text,
  planning_status text,
  state text,
  city text,
  region text,
  booking_date date,
  event_start_date date,
  event_end_date date,
  event_month text,
  venue text,
  venue_gmv numeric,
  team_lead text,
  planner text,
  designer text,
  project_manager text,
  rm text,
  vendor_manager text,
  hospitality_vendor text,
  decor_vendor text,
  venue_poc text,
  vd_status text,
  package_link text,
  infinity_link text,

  -- Risk Tracker fields
  bgmv numeric,
  package_price_eff numeric,
  collection numeric,
  collection_pct numeric,
  sentiment text,
  cancellation_risk smallint,
  cancellation_risk_reason text,
  project_health smallint,
  project_health_reason text,
  current_summary text,
  ai_notes_summary text,
  no_of_whatsapp_groups smallint,
  planner_assigned_date date,
  last_message_date date,
  t_days int,
  d_days int,
  communication_days int,

  -- Calculated risk labels
  collection_risk text,
  collection_risk_summary text,
  communication_risk text,
  sentiment_risk text,
  overall_pid_risk text,
  overall_risk_summary text,

  -- Metadata
  synced_at timestamptz not null default now()
);

create index projects_team_lead_idx on public.projects (team_lead);
create index projects_planner_idx on public.projects (planner);
create index projects_designer_idx on public.projects (designer);
create index projects_project_manager_idx on public.projects (project_manager);
create index projects_overall_pid_risk_idx on public.projects (overall_pid_risk);
create index projects_cancellation_risk_idx on public.projects (cancellation_risk);

-- Sync log: one row per sync run
create table public.sync_log (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running', -- 'success' | 'error' | 'running'
  rows_upserted int,
  error_message text
);

-- User PID mapping: which PIDs each user can see
create table public.user_pids (
  user_email text primary key,
  pids bigint[] not null,
  refreshed_at timestamptz not null default now()
);

-- Enable RLS
alter table public.projects enable row level security;
alter table public.sync_log enable row level security;
alter table public.user_pids enable row level security;

-- RLS: users see only their own PIDs
create policy "Users see their own projects"
  on public.projects
  for select
  using (
    exists (
      select 1 from public.user_pids
      where user_email = auth.email()
      and pid = any(pids)
    )
  );

-- RLS: sync_log is read-only for authenticated users
create policy "Authenticated users can read sync log"
  on public.sync_log
  for select
  to authenticated
  using (true);

-- RLS: users see only their own user_pids row
create policy "Users see their own pid mapping"
  on public.user_pids
  for select
  using (user_email = auth.email());
