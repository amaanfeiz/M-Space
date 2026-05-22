-- Stores free-form feedback on AI briefs.
-- Powers the Phase 6 learning loop.

create table public.brief_feedback (
  id         uuid        primary key default gen_random_uuid(),
  brief_id   uuid        not null references public.briefs(id),
  pid        bigint      not null references public.projects(pid),
  user_input text        not null,
  created_at timestamptz not null default now()
);

create index brief_feedback_brief_id_idx on public.brief_feedback(brief_id);
create index brief_feedback_pid_idx      on public.brief_feedback(pid);

alter table public.brief_feedback enable row level security;

create policy "auth users can manage brief_feedback"
  on public.brief_feedback for all
  to authenticated
  using (true)
  with check (true);
