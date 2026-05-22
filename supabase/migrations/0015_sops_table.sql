-- Phase 1 — Step 11: normalized sops table.
--
-- Seeds 36 SOPs from Amaan_Planning_TL_AI_Brain_Handoff_Phase1.md § 18
-- via `scripts/seed-sops.ts` (run after migration applies). Every SOP cites
-- a framework_source matching a file in frameworks/.
--
-- Rollback:
--   begin;
--   drop policy if exists "auth users can read sops" on public.sops;
--   drop index if exists public.sops_role_idx;
--   drop index if exists public.sops_stage_idx;
--   drop table if exists public.sops;
--   commit;

begin;

create table public.sops (
  sop_id           text primary key,
  stage            text not null,
  package_tier     text not null default 'All',
  role             text not null,
  category         text not null,
  title            text not null,
  body             text not null,
  framework_source text,
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index sops_stage_idx on public.sops(stage);
create index sops_role_idx on public.sops(role);
create index sops_framework_idx on public.sops(framework_source);

alter table public.sops enable row level security;

create policy "auth users can read sops"
  on public.sops for select to authenticated using (true);

commit;
