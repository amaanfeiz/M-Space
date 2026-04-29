# Phase 1 Build Plan — Meragi Operations Intelligence

> Read alongside `claude.md`. This file is the milestone-by-milestone roadmap. Treat each milestone as atomic: complete and verify before starting the next.

## Phase 1 goal (one sentence)

Replace the static v5.6 demo with a Next.js + Supabase app that shows Amaan his real portfolio (drawn from live Google Sheets), authenticated via @meragi.com Google login, deployed to Vercel — preserving the v5.6 design system exactly and degrading gracefully where chat-derived data is absent.

## Phase 1 explicitly does NOT include

- WhatsApp chat scraping or live chat ingestion (Phase 2)
- Custom Claude API analysis layer (Phase 2)
- Edit capability — read-only only in Phase 1 (Phase 1.5+)
- Other 5 TLs as users (Phase 1.5)
- Planner/designer/PM individual logins (Phase 1.5+)
- Slack alerts, email digests (Phase 2)
- Audit log for "who saw what" (Phase 1.5)
- The Coplanner BETA tab — preserve as a placeholder route, but disable the input. Phase 2 builds the AI co-planner properly.

If anything in this list needs revisiting, surface it to Amaan; do not silently expand scope.

---

## M1 — Repo bootstrap (target: Day 1, ~2 hours)

**Goal:** Existing GitHub repo restructured into a Next.js project, the v5.6 HTML preserved as reference, deployed and showing a "hello" page on Vercel.

**Steps:**

1. In the existing repo working directory, create a new branch: `phase-1-build`. The demo `index.html` stays on `main` until phase 1 ships.
2. On the new branch, scaffold Next.js 15 with TypeScript and Tailwind:
   ```
   pnpm create next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*"
   ```
   When asked about overwriting files, keep the demo `index.html` by moving it first to `reference/v5_6.html`.
3. Move all CSV samples (Risk Tracker, Live Tracker) into `reference/` too. Add `reference/*.csv` to `.gitignore` (we don't want client data in git) but keep `reference/v5_6.html` committed.
4. Install core deps:
   ```
   pnpm add @supabase/supabase-js @supabase/ssr lucide-react date-fns clsx tailwind-merge
   pnpm add -D @types/node
   ```
5. Set up Tailwind theme tokens that match v5.6's CSS variables. Create `app/globals.css` with the full `:root` and `html[data-theme="dark"]` blocks ported verbatim from `reference/v5_6.html`. Then expose them as Tailwind theme extensions in `tailwind.config.ts` so utility classes like `bg-surface` and `text-accent` work.
6. Replace the default Next.js homepage with a placeholder that renders "Meragi Intel" using the v5.6 logo treatment (Nunito 800, `--accent` dot).
7. Push to GitHub. Vercel should auto-deploy from the connected branch — confirm the new build shows the placeholder.

**Acceptance:**
- Vercel URL shows "Meragi Intel" with correct fonts and colors.
- `reference/v5_6.html` is committed.
- `pnpm dev` runs locally without errors.
- Theme toggle infrastructure exists (even if no toggle UI yet) — `data-theme="dark"` flips colors correctly.

**Stop and ask Amaan:** to share the Vercel URL and confirm it loads.

---

## M2 — Supabase Auth with Google + @meragi.com restriction (target: Day 2, ~3 hours)

**Goal:** Amaan can log in with his @meragi.com Google account; non-@meragi.com emails are rejected; logged-out users see a clean sign-in page.

**Steps:**

1. In the Supabase project (already provisioned), enable Google OAuth provider. Walk Amaan through:
   - Creating a Google Cloud project (if he doesn't have one): https://console.cloud.google.com → New Project → "Meragi Intel"
   - Configuring OAuth consent screen (Internal if Meragi has Workspace; External otherwise)
   - Creating an OAuth Client ID (Web application type) with the Supabase callback URL as authorized redirect
   - Pasting the Client ID and Client Secret into Supabase → Authentication → Providers → Google
2. In Supabase Authentication settings, set Site URL to the Vercel deployment URL.
3. In the Next.js app, set up `@supabase/ssr` per the official Next.js App Router pattern. Create:
   - `lib/supabase/client.ts` (browser client)
   - `lib/supabase/server.ts` (server component client)
   - `middleware.ts` (refresh sessions on every request)
4. Create routes:
   - `app/login/page.tsx` — sign-in screen with "Continue with Google" button. Match v5.6 visual language: surface card on bg, accent button.
   - `app/auth/callback/route.ts` — exchanges the code for a session. **Critical:** in this handler, after exchange, check the user's email. If it doesn't end in `@meragi.com`, sign them out and redirect to login with an error. If it does end in `@meragi.com` but isn't `amaan@meragi.com` (or whatever Amaan's actual address is), also reject with a "Phase 1 access only" message.
5. Add a root layout check: any unauthenticated request to a protected route (everything except `/login` and `/auth/*`) redirects to `/login`.

**Acceptance:**
- Visiting the site logged out → redirected to `/login`.
- Clicking "Continue with Google" with Amaan's @meragi.com → lands on the dashboard placeholder.
- Logging in with a non-@meragi.com personal account → bounced back to login with an error toast.
- Logging in with a @meragi.com account that isn't Amaan's → bounced back with a "Phase 1 access only" message. (Test this by temporarily allowlisting a second email, then removing it.)

**Stop and ask Amaan:** to test all four cases above and confirm. Get his exact email address before hardcoding it. The hardcoded allowlist is a **Phase 1.0 only** measure — note in code with `// PHASE-1.5: replace with users table allowlist`.

---

## M3 — Postgres schema + initial sync from Sheets (target: Day 3-4, ~4 hours)

**Goal:** Both Google Sheets are mirrored into Supabase Postgres tables. A scheduled function refreshes them every 15 minutes. RLS policies enforce per-user PID visibility.

**Steps:**

1. Define schema. Create migration `supabase/migrations/0001_initial.sql`:
   ```sql
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
     -- Calculated risks (text labels: "Critical" / "Attention" / "Healthy" / etc.)
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

   create table public.user_pids (
     user_email text primary key,
     pids bigint[] not null,
     refreshed_at timestamptz not null default now()
   );
   ```
2. Enable RLS on `projects`. Create policy: users can `select` only rows where `pid = ANY((select pids from user_pids where user_email = auth.email()))`.
3. Create `supabase/functions/sync-sheets/` Edge Function. It:
   - Fetches both sheets via Google Sheets API v4 (using a service account, JSON key stored as `GOOGLE_SHEETS_SA_KEY` secret).
   - Parses, joins on PID, upserts into `projects`.
   - Recomputes `user_pids` for each known user email by scanning `team_lead`, `planner`, `designer`, `project_manager` columns.
   - Logs to a `sync_log` table (success/fail, row count, duration).
4. Schedule it: Supabase has cron via `pg_cron` extension. Create migration:
   ```sql
   select cron.schedule(
     'sync-sheets-every-15-min',
     '*/15 * * * *',
     $$select net.http_post(url := 'https://<project>.supabase.co/functions/v1/sync-sheets', headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.cron_secret')))$$
   );
   ```
5. Manually trigger the function once to backfill. Verify row count matches the sheets.

**Acceptance:**
- `select count(*) from projects;` returns ~125 (matches Risk Tracker row count).
- `select count(*) from projects where team_lead = 'Amaan Abdul Kader';` returns 31.
- `select pids from user_pids where user_email = '<amaan>@meragi.com';` returns an array containing those 31 PIDs.
- Manually editing a cell in the Live Tracker → 15 minutes later, the change is reflected in the Postgres row. Verify with one test edit Amaan reverts.
- A non-allowlisted user querying `projects` via the JS client gets 0 rows (RLS working).

**Stop and ask Amaan:** to (a) create the Google service account JSON key and share both Sheets with the service account email, (b) verify the sync log shows success, (c) test one cell edit → 15-min refresh.

---

## M4 — Dashboard view (target: Day 5-7, ~6 hours)

**Goal:** The Dashboard route (`/`) renders a faithful port of v5.6's Dashboard view, populated from real `projects` data filtered to Amaan's PIDs.

**Steps:**

1. Build shared layout: `app/(app)/layout.tsx` with the v5.6 sidebar (logo + nav items: Dashboard, Projects, Team, Intelligence, Coplanner [BETA], Reports, Settings) and the topbar (page title, search, sync pill, theme toggle, role switcher, user avatar). Port the structure from `reference/v5_6.html` lines 558-657.
2. Build dashboard view at `app/(app)/page.tsx`. Section breakdown (each becomes its own component in `components/dashboard/`):
   - **Welcome banner** — server-side compute "things needing you today": top 3 PIDs ranked by `overall_pid_risk` severity. Use `current_summary` for the descriptive text.
   - **What Changed strip** — Phase 1 fallback: show the most recently synced 5-7 projects with `current_summary` excerpts as the "events." Real change-events are Phase 2 (requires diff logging). Mark this section with a small "Last 24 hours" label that's accurate to sync timestamps.
   - **Stalled Projects** — server-computed: where `communication_days > 14` and status not in ('Cancelled', 'Concluded'). Show top 3.
   - **Executive Briefing** — Phase 1 fallback: render Amaan's `current_summary` aggregate or a templated string. Real briefing generation is Phase 2.
   - **Metrics row** — 4 metrics: Live PIDs (count where status = 'Booked'), Total BGMV (sum), Critical Risks (count where overall_pid_risk = 'Critical'), Attention Items (count where overall_pid_risk = 'Attention').
   - **Today's Priorities** — top 5 PIDs by risk severity, click-through to detail panel.
   - **Risk Monitor** — top 5 PIDs by cancellation_risk, with sparkline. Sparkline data: Phase 1 placeholder (a flat line at the current risk score). Real sparklines are Phase 2 (requires risk history table).
   - **Team Performance** — count of PIDs per planner under Amaan, with avg health score.
   - **Activity Feed** — Phase 1 fallback: most recent `last_message_date` events across Amaan's PIDs.
3. Each section that's a "Phase 1 fallback" gets a tiny subtle indicator — a small dim text like "synced data" — so Amaan can tell at a glance which sections will get richer in Phase 2.

**Acceptance:**
- Dashboard loads in under 2 seconds.
- All numbers match what Amaan can compute from the trackers manually.
- Clicking any PID anywhere opens the detail panel (M5).
- Theme toggle works.
- Sidebar navigation works (the other tabs route correctly even if they're stubs).

**Stop and ask Amaan:** to verify the numbers against his existing TL Dashboard sheet. Specifically: total BGMV, count of critical PIDs, top 3 stalled projects.

---

## M5 — Detail panel (target: Day 8-10, ~6 hours)

**Goal:** Clicking a PID anywhere opens a slide-in panel with the full v5.6 detail layout, populated from `projects` for tracker-derived sections and from a static `pid_data_static.ts` for chat-derived sections (Amaan's 20 PIDs only).

**Steps:**

1. Extract the v5.6 `PID_DATA` JSON from `reference/v5_6.html` (lines ~1374-2370 contain the dict). Save as `lib/static/pid_data_static.ts` — a strongly-typed const exporting just the chat-derived fields (team_status engagement details, comms.open_commitments, vendor_coverage, decision_intel, actions, messages, tl_directive, suggested_client_reply). Drop fields that are now better-sourced from the DB (couple, venue, money basics).
2. Build `components/panel/DetailPanel.tsx` — slide-in panel triggered by click. Fetches project by PID from Postgres, then merges in static data if PID is in `pid_data_static`. Renders the v5.6 panel layout exactly.
3. Apply the **honest-degrade rule** from `claude.md`: each section checks whether it has data; if not, it doesn't render. No "coming soon" placeholders. No empty headers. The panel is compact when data is sparse, rich when data is dense.
4. Wire panel-open from every PID reference: priority rows, risk rows, activity rows, search results, etc. Use a single `openPanel(pid)` helper or, better, a `<PIDLink pid={...}>` component.
5. Close behavior: ESC key, click outside, X button — all close the panel. URL hash reflects open state (`#pid=24292`) so deep links work.

**Acceptance:**
- For any of Amaan's 20 PIDs, panel renders with full content matching v5.6.
- For another TL's PID (e.g., one of Utsarinee's 25), panel renders with: header, status, risk vectors, AI analysis paragraph(s), team names, money — and **nothing else**. No placeholders.
- Deep link works: visiting `https://<url>/?pid=22206` opens dashboard with that panel open.

**Stop and ask Amaan:** to spot-check 3 of his PIDs and 3 of someone else's. Confirm the degradation reads as "honest" not "broken."

---

## M6 — Other views (Projects, Team, Intelligence) + polish (target: Day 11-14, ~6 hours)

**Goal:** Remaining views ported from v5.6 with real data; small polish pass; ready for Amaan's daily use.

**Steps:**

1. **Projects view** — paginated table of all of Amaan's projects with sortable columns (PID, couple, event date, planner, designer, PM, status, risks). Click row → detail panel.
2. **Team view** — port the cross-team assignments and workload matrix from v5.6, populated from real planner/designer/PM counts.
3. **Intelligence view** — port the 6 insight cards. Each card's content comes from aggregations: e.g., "Top revenue at risk" sums BGMV of critical-risk projects. Cards that depended on chat analysis in v5.6 (e.g., "Client sentiment trend") get a Phase 2 placeholder card explaining what'll be there.
4. **Coplanner view** — render the route, but the input box is disabled with a "Phase 2" caption. Preserve the visual.
5. **Reports view** — Phase 1: a single button that exports current-portfolio-CSV. Anything fancier is Phase 2.
6. **Settings view** — Phase 1: just shows the user's email, role, and a "Sign out" button.
7. **Sync pill** — wire to actually show last sync time from the `sync_log` table. Pulse green when synced <30 min ago, amber when 30-60 min, red when >60 min.
8. Polish pass: every page loads <2s, no console errors, lighthouse score >90 on the dashboard.

**Acceptance:**
- All 7 nav items lead to functional views.
- No "Coming Soon" or "TODO" visible anywhere except the explicitly-labeled Phase 2 placeholders.
- Amaan uses it for one full workday and reports back.

**Stop and ask Amaan:** for the workday-of-use feedback. Phase 1 ends here; whatever he wants in Phase 1.5 gets a separate brief.

---

## Phase 1.5 sneak preview (do not start without explicit go-ahead)

- Open access to the other 5 TLs (remove the Amaan-only allowlist; the @meragi.com filter stays)
- Audit log: `select_log` table that records who opened which PID
- Edit capability v0: per-user "I've handled this" check on action items (requires action items to come from somewhere — likely Phase 2)
- Daily email digest at 9 AM
- Slack alert webhook for new criticals

## Phase 2 sneak preview

- Custom Claude API analysis layer on real chat data (once Amaan has central chat access)
- Replace strategy team's tracker dependency with own analysis
- Live "What Changed" diff log
- Real sparklines from risk history
- Coplanner AI agent (the most exciting Phase 2 piece — this is where the wedding-planning brain integration starts)
