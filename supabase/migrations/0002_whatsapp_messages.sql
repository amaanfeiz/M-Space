-- Raw messages pulled from WhatsApp groups by the scraper
create table public.whatsapp_messages (
  id             uuid        primary key default gen_random_uuid(),
  pid            bigint      not null references public.projects(pid),
  group_type     text        not null check (group_type in ('client', 'internal')),
  group_name     text        not null,
  wa_message_id  text        not null unique,
  sender_wa_id   text,
  sender_name    text,
  body           text,
  message_type   text        not null default 'chat',
  has_media      boolean     not null default false,
  sent_at        timestamptz not null,
  scraped_at     timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

create index whatsapp_messages_pid_idx      on public.whatsapp_messages(pid);
create index whatsapp_messages_sent_at_idx  on public.whatsapp_messages(sent_at desc);

alter table public.whatsapp_messages enable row level security;

-- Authenticated users can read messages for any PID (Phase 1: just Amaan)
create policy "auth users can read whatsapp_messages"
  on public.whatsapp_messages for select
  to authenticated
  using (true);

-- AI summary per PID per day — populated by Edge Function in next milestone
create table public.daily_pid_summary (
  id                     uuid    primary key default gen_random_uuid(),
  pid                    bigint  not null references public.projects(pid),
  summary_date           date    not null,
  client_summary         text,
  internal_summary       text,
  message_count_client   integer not null default 0,
  message_count_internal integer not null default 0,
  model_used             text,
  generated_at           timestamptz,
  created_at             timestamptz not null default now(),
  unique (pid, summary_date)
);

alter table public.daily_pid_summary enable row level security;

create policy "auth users can read daily_pid_summary"
  on public.daily_pid_summary for select
  to authenticated
  using (true);
