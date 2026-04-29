# Meragi Operations Intelligence — Project Context

> This file is read by Claude Code at the start of every session. Keep it accurate, keep it terse. If it grows past ~250 lines, split it.

## Who and what

**Builder:** Amaan Abdul Kader. Team Lead at Meragi Celebrations (Indian destination weddings). Manages 4 sub-teams across the destination department. Self-described beginner at coding — comfortable in Sheets and Claude chat, struggled with the demo's GitHub/Vercel setup. Treat him as a smart, busy non-engineer who needs commands explained the first time and doesn't need them re-explained the second time.

**Product:** A web dashboard that gives Meragi's destination team (TLs, planners, designers, PMs) a daily operations view of their projects — risk signals, payment status, communication freshness, AI analysis — drawn from two Google Sheets (CRM tracker + strategy team's risk analysis tracker). Replaces the current behavior of cross-referencing 3-4 sheets every morning to figure out what's broken.

**Phase 1 user:** Amaan only. The system is built multi-tenant from day one, but only one human logs in for the first 2-3 weeks of production use. Phase 1.5 invites the other 5 TLs once Amaan has validated the system in real use.

## What already exists

- `reference/v5_6.html` — the v5.6 demo prototype. ~3,500 lines, single HTML file. Vanilla JS, no framework. Beautiful design system with Inter/Geist/Nunito fonts, accent purple `#7241BE`, dark mode, 6 views (Dashboard, Projects, Team, Intelligence, Coplanner [BETA], Reports, Settings). 20 PIDs of hardcoded full demo data in `PID_DATA`. **This file is reference material — preserve every visual token, every component pattern, every piece of copy. Do not "improve" the design.**
- GitHub repo (already created during demo deployment)
- Vercel project (already deployed for demo)
- Supabase project (provisioned in setup; region `ap-south-1` Mumbai)
- Two Google Sheets:
  - `Risk Tracker` (strategy team's AI analysis): https://docs.google.com/spreadsheets/d/1NczQ85_5pZAHKQW_Ctie5pc2I16xrew1fTchb1HF6y0/
  - `Live Tracker` (CRM source-of-truth): URL TBC by Amaan

## Architecture (locked — do not relitigate)

```
Google Sheets (Risk Tracker + Live Tracker)
    ↓ scheduled sync every 15 min via Supabase Edge Function pulling Sheets API
Supabase (Postgres mirror, RLS enforced)
    ↓ Next.js (App Router) reads via @supabase/ssr
Dashboard on Vercel (Google OAuth, @meragi.com domain restricted)
```

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS · Supabase (Postgres + Auth + Edge Functions) · Vercel · pnpm.

**No Claude API at runtime in Phase 1.** The AI analysis is consumed pre-computed from the Risk Tracker. Phase 2 will add a custom analysis layer once Amaan has chat data access.

## Data sources

### Risk Tracker (strategy team's analysis)
Source of truth for: AI analysis content, calculated risk fields (Collection Risk, Communication Risk, Sentiment Risk, Cancellation Risk, Health Score Risk, Overall PID Risk), `cancellation_risk` (0-5), `project_health` (1-5), sentiment, `current_summary`, `ai_notes_summary`, `T-days`, `D-Days`, `Communication Days`, `Collection %`.

### Live Tracker (CRM)
Source of truth for: roster (TEAM LEAD, PLANNER, DESIGNER, PROJECT MANAGER), couple names (CX NAME e.g. "Rashmee & David"), venue, dates, planning status, region/state/city, package link, project price, payment amounts.

### Join key
PID. Risk Tracker stores `pid` with thousand-comma formatting ("22,206") in CSV — strip commas before joining. Live Tracker stores `PID NO` as plain integer (22206). Cast both to integer in the sync.

### "Stylist" gotcha
The Destination Tracker Raw Data Dump (older CRM export) has a column literally named `stylist` that holds TL identity. **Ignore that file.** Use the Live Tracker instead, which has a correctly-named `TEAM LEAD` column.

## Honest-data degradation rule (critical)

The v5.6 demo hardcoded 12 detail-panel sections per PID. Only some of those are populatable from the trackers. Phase 1 detail panel must conditionally render:

| Detail panel section | Data source | Phase 1 behavior |
|---|---|---|
| Header (PID, couple, event date, venue) | Live Tracker | Always shown |
| Status pill + sparkline | Risk Tracker calculated risks | Always shown |
| Risk vectors | Risk Tracker risk fields | Always shown |
| AI analysis paragraphs | Risk Tracker `current_summary` + `ai_notes_summary` | Shown if non-empty |
| Team status (with engagement, last_action, carrying_signal, notes) | Live Tracker (names) + chat data (engagement detail) | Names always shown; engagement/notes fields shown only if static fallback exists for this PID |
| Comms (open commitments, off-channel, client chattiness) | Chat analysis only | Shown only if static fallback exists |
| Money (collection %, next due, plan notes) | Live + Risk Trackers | Always shown |
| Vendor coverage | Chat analysis only | Shown only if static fallback exists |
| Decision intel | Chat analysis only | Shown only if static fallback exists |
| Action items | Chat analysis only | Shown only if static fallback exists |
| Recent messages | Chat analysis only | Shown only if static fallback exists |
| TL directive | Chat analysis only | Shown only if static fallback exists |
| Suggested client reply | Chat analysis only | Shown only if static fallback exists |

**"Static fallback" = the PID exists in Amaan's 20-PID `PID_DATA` from v5.6.** For those 20, render the full panel. For everyone else's PIDs, render only the tracker-backed sections. This is non-negotiable: **do not generate placeholder content** for sections we don't have real data for.

## Auth rules

- Google OAuth via Supabase Auth. Restrict to `@meragi.com` domain only.
- User ↔ PID mapping: a Postgres view that joins `auth.users.email` against the Live Tracker's TL/PLANNER/DESIGNER/PROJECT MANAGER columns to compute the set of PIDs each user can see. Implemented as Supabase RLS so it's enforced at the database level, not application code.
- Phase 1 allowlist: only amaan.kader@meragi.com may log in. Hardcode this in the auth callback with a comment // PHASE-1.5: replace with users table allowlist.

## Visual constraints

- Preserve every CSS variable from `reference/v5_6.html` exactly. Port to Tailwind via custom theme tokens or via plain CSS variables in `globals.css`.
- Preserve component patterns: cards, briefing-card, metric-row, priority-row, risk-row, activity-row, panel-header, panel-body, status-dot, sparkline.
- Preserve copywriting tone in any new prose: terse, observational, specific. **No emojis.** No exclamation marks. No marketing language.
- Dark mode must work from day one (the demo already has it via `html[data-theme="dark"]`).
- Mobile responsiveness: TLs use laptops primarily but need phone access for after-hours. Don't break the existing mobile sidebar/hamburger behavior.

## Hard rules for Claude Code

1. **Never push to GitHub without Amaan's explicit "push it" instruction.** Stage and commit locally; let him review `git status` and `git diff` before push.
2. **Never run destructive operations without confirmation.** Includes: `git reset --hard`, `git push --force`, `rm -rf`, `DROP TABLE`, `supabase db reset`. Always pause and ask first.
3. **Never put secrets in code.** Supabase URL is public-fine; anon key is public-fine in client; service role key, OAuth client secret, Google API key go in `.env.local` only, never committed. `.env.local` must be in `.gitignore`.
4. **Stop and ask before changing architecture.** Stack is locked above. If something seems to need a different choice, surface it and wait for Amaan to decide.
5. **Stop and ask before "improving" v5.6 visuals.** Even small tweaks. Preserve the design system.
6. **Stop and ask if a build step requires Amaan to do something in a UI you can't see** — Google Cloud Console, Supabase dashboard, Vercel settings. Walk him through it; don't assume he's done it.
7. **When stuck for more than 2 attempts on the same problem, surface it.** Don't burn through retries silently.
8. **Run `pnpm typecheck` and `pnpm lint` before committing.** No silent type errors making it to git history.

## Repo conventions

- `pnpm` only, no npm/yarn.
- TypeScript strict mode. No `any`. No `// @ts-ignore`.
- Server components by default; `"use client"` only where actually needed.
- Tailwind utility classes; co-locate component styles with components.
- Component files in `components/`, route handlers in `app/`, lib utilities in `lib/`, Supabase types in `lib/database.types.ts` (generated).
- Reference files (the v5.6 HTML, the CSV samples) go in `reference/` and are gitignored from sync but committed for context.

## When to come back to Amaan vs proceed

**Proceed without asking when:** writing code that follows this brief, fixing your own bugs, refactoring within architecture, choosing between technically-equivalent libraries (e.g., date-fns vs dayjs).

**Stop and ask when:** something contradicts this brief; a milestone is complete and Amaan needs to verify; a new architectural decision arises; you need credentials or env vars; a destructive operation; the brief is silent on something user-facing (UI copy, ordering, defaults).

**Always tell Amaan when:** a milestone is done and how to verify it; a hard rule above was relevant; you've waited 2+ retries on a stuck problem.
