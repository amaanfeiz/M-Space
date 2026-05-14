-- Maps each (pid, sender_name) pair to a role + display label.
-- Populated by scripts/whatsapp-scraper/resolve-senders.ts after each scrape/ingest.

create table public.signal_senders (
  pid           bigint not null references public.projects(pid),
  sender_name   text   not null,
  role          text   not null check (role in (
                  'client', 'team_lead', 'planner', 'designer',
                  'project_manager', 'rm', 'vendor_manager',
                  'meragi_other', 'vendor', 'unknown'
                )),
  display_label text,                    -- "Bhavika (Planner)" — what brief renders
  notes         text,
  resolved_via  text   not null check (resolved_via in ('auto_projects', 'auto_llm', 'manual')),
  resolved_at   timestamptz not null default now(),
  primary key (pid, sender_name)
);

create index signal_senders_pid_idx on public.signal_senders(pid);

alter table public.signal_senders enable row level security;

create policy "auth users can read signal_senders"
  on public.signal_senders for select
  to authenticated
  using (true);
