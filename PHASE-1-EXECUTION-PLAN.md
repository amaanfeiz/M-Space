# Phase 1 Execution Plan — Single Burn

**You are Opus, executing this plan end-to-end on branch `phase-1-execution`.**

This is the consolidated single-burn execution of everything Phase 1 unlocks. No 4-week sandbag. Work through the steps in order. Each step commits independently with clean typecheck + lint + working dev server.

**Execution-specific approvals (granted 2026-05-22):**
- Single push to `phase-1-execution` remote at end (Step 17.4), not per commit.
- Merge to `main` locally with `--no-ff` and push main (Step 17.5).
- Vercel auto-deploys after main push — Amaan reconnects auto-deploy in dashboard before this step.
- Fresh full-pipeline scrape on the new architecture as part of final integration.
- Portfolio tab added inside the dashboard shell (Step 16.5).

---

## Required pre-reads (in this order)

1. `C:\Users\Amaan\Obsidian\Meragi-Intel\Amaan_Planning_TL_AI_Brain_Handoff_Phase1.md` — the 1686-line operating model. THE source of truth. Re-read § 19 (style guide), § 18 (SOPs), § 20 (watch signals), § 24 (takeaways) before any prompt edit.
2. `C:\Users\Amaan\Obsidian\Meragi-Intel\decisions\2026-05-22-phase-1-interview-locked.md` — the lock + the five conceptual shifts.
3. `C:\Users\Amaan\Obsidian\Meragi-Intel\decisions\2026-05-19-brief-analysis-tiers.md` — tier model + cost envelope.
4. `C:\Users\Amaan\Obsidian\Meragi-Intel\frameworks\00-index.md` — frameworks layer for SOP grounding.
5. The Claude memory at `C:\Users\Amaan\.claude\projects\C--Users-Amaan\memory\` — particularly `feedback_hard_rules`, `feedback_data_verification_first`, `feedback_data_sources_hierarchy`.

Do not skim. The five conceptual shifts must be in your head before you touch any prompt or schema.

---

## Hard rules

- **Push discipline.** No push to remote during the burn. Single push to `phase-1-execution` at end (Step 17.4). Merge to `main` locally with `--no-ff` and push main (Step 17.5). No force-push anywhere.
- **Bounded cleanup only.** When you touch a file for an in-scope step, you MAY clean obviously-dead code in that file: unused imports, commented-out blocks from prior phases, unreachable branches that confused you while reading. Anything bigger — cross-file refactors, new abstractions, renames, "this whole module should be different" — goes into `PHASE-1-OPPORTUNITIES.md` at repo root with file path + line numbers + one-line "why." Amaan reviews after the burn. No scope creep inside the burn.
- **No destructive migrations** without a tested rollback SQL alongside.
- **No `--no-verify`** on commits. If a pre-commit hook fails, fix the underlying issue.
- **Each commit:** clean `pnpm typecheck` + clean `pnpm lint` + dev server boots without console errors.
- **If you hit a blocker** (data not available, schema conflict, unclear spec), STOP and append to `PHASE-1-BLOCKERS.md` at repo root with: the step, the blocker, what you tried, options. Do not work around.
- **Verify data before designing on top of it.** Memory notes are inert — sample real table rows before assuming structure. (See `feedback_data_verification_first`.)
- **Brief schema changes** require regenerating ≥3 briefs and visually verifying the detail panel renders before commit.
- **No drafting** of founder escalations, hard refusals, recovery scripts, or sharp messages. Surface "may need direct call" flag instead. This is Rule 19 of the style guide. Hard constraint.
- **Live Tracker is source of truth** for hard facts (couple name, dates, venue, team, payments, scores). Risk Tracker analytical text stays out of context. (See `feedback_data_sources_hierarchy`.)

---

## The five conceptual shifts (memorize)

1. **Source-aware framing** — every signal carries `source_group`; same content has inverted severity across groups.
2. **Two-axis triage** — category severity (macro) × client-experience (intra-day).
3. **Continuity** — today's draft continues yesterday's conversation.
4. **AI uncertainty first-class** — per-PID clarification Q/A persists.
5. **State, not just chat** — phase + recovery + heightened-monitoring drive brief logic.

---

## Step 0 — Foundation pre-flight (≤30 min)

**0.1 Verify detail-panel on `detail-panel-merge` in browser** with `BYPASS_AUTH=1`. Three PIDs: 28438 (normal), 24292 (post-event), 29568 (silence brief). If broken, fix or roll back. Do not proceed otherwise.

**0.2 Reschedule cron.** `MeragiIntelNightly` is set for 22:00 IST, but the laptop's Modern Standby + disabled wake timers mean it didn't fire on 2026-05-20. See `reference_laptop_cron_constraints` memory. Move to 23:00 IST (laptop reliably open):

```powershell
Set-ScheduledTask -TaskName MeragiIntelNightly `
  -Trigger (New-ScheduledTaskTrigger -Daily -At 23:00)
Get-ScheduledTask -TaskName MeragiIntelNightly | Select-Object NextRunTime
```

Verify `NextRunTime` is tomorrow 23:00.

**0.3 Re-run T3** with current data:

```powershell
cd C:\Users\Amaan\Projects\meragi-intel\scripts\whatsapp-scraper
npx tsx t3-portfolio-brief.ts
```

Confirm portfolio brief renders at `C:\Users\Amaan\Obsidian\Meragi-Intel\portfolio\<today>.md`.

**0.4 Create execution branch:**

```powershell
git checkout detail-panel-merge
git pull
git checkout -b phase-1-execution
```

No commits at Step 0 unless 0.1 fix needed. Just baseline.

---

## Step 1 — T1 prompt patch (full 19-rule style guide)

**File:** `scripts/whatsapp-scraper/generate-brief.ts` (system prompt).

Replace the existing 5-rule patch with the full 19-rule style guide from § 19 of the Phase 1 handoff. Critical additions vs current prompt:

- **Rule 11** — terse, no jargon, no corporate register, no American-corporate phrasing.
- **Rule 12** — continuity. Today's draft continues yesterday's conversation. Read what Amaan or the team said yesterday and frame today's nudge as a follow-up.
- **Rule 13** — sharpness is never in the draft. If a situation calls for sharper energy, surface "this may need a direct call" — do not write the sharper version.
- **Rule 14** — direct-call trigger: count (2 ignored nudges) + thread-optics (3rd public chase damages the visible thread).
- **Rule 15** — AI 24-hour self-loop. Track Amaan's own group asks. At 24h without team response, surface "you asked X yesterday on PID Y, no answer yet" and draft soft re-ping.
- **Rule 16** — source-aware framing. Every signal carries its source group. CP/SP in internal = healthy; CP/SP in client = severity-1.
- **Rule 17** — cross-group context can de-flag. Internal-group explanation suppresses client-group flag (within 72h window).
- **Rule 18** — AI clarification subsection. Per-PID "I don't know" list is allowed and encouraged.
- **Rule 19** — no escalation drafts. Never founder packets, hard refusals, or recovery scripts.

The full text is in § 19 of the handoff. Copy verbatim into the system prompt, do not paraphrase.

**Acceptance:** Generate one brief on PID 28438. Read it. The brief should read tighter than before, source-aware, and contain at least one explicit "I'm not sure about X" clarification line.

**Commit:** `feat(t1-prompt): apply full Phase 1 style guide (19 rules)`

---

## Step 2 — W1 conversational continuity

This was the queued-highest-priority workstream from the detail-panel-merge spec. Now Step 2.

**2.1 Load prior-day context into T1 prompt:**

For each PID being briefed, fetch:
- Yesterday's brief's `clarification_evaluations.actual_sent` (the message Amaan actually sent, or that the team sent)
- Last 14 days of chat responses to those messages
- Whether the team responded substantively (heuristic: non-emoji reply >10 chars OR ack message within 24h)

Pass this as a new section in the T1 prompt context: `## Yesterday's open threads`.

**2.2 Rewrite OPEN QUESTIONS draft generation as follow-up-aware:**

If a question is open from yesterday and unanswered, today's draft should reference it explicitly:
- ❌ "Hey team, what's the update on decor?"
- ✅ "Guys, any movement on the decor timeline I asked about yesterday?"

If yesterday's question got a partial answer, draft a clarifying follow-up:
- ✅ "Got the photographer name but still waiting on the quote breakdown — can we close that out today?"

**2.3 Verify B7 Copy → DB write:**

The `app/api/clarification-sent/route.ts` endpoint shipped in detail-panel-merge writes edited message to `clarification_evaluations.actual_sent` immediately on copy. Verify the write actually happens by clicking Copy in the detail panel and checking the DB row.

**Acceptance:** Generate tomorrow's PID 28438 brief. If yesterday's open question on 28438 wasn't answered, today's brief explicitly references yesterday's ask. Test with a synthetic prior-day brief if needed.

**Commit:** `feat(t1): conversational continuity — load prior-day actual_sent + chat responses`

---

## Step 3 — Deterministic lexical pre-pass (severity-1)

**New file:** `scripts/whatsapp-scraper/lexical-flags.ts`. Runs after scrape, before T1. Bilingual (English + Hindi/Hinglish) detectors.

**Migration:** `supabase/migrations/0012_lexical_flags.sql`:

```sql
create table lexical_flags (
  id uuid primary key default gen_random_uuid(),
  pid int not null,
  signal_id text not null,        -- WS14, WS15, WS41, WS42, WS43, WS50
  severity text not null,         -- critical | high | medium | low | trend_watch
  source_group text not null,     -- internal_pid_group | client_group | venue_group
  matched_text text not null,
  message_id text references signals(id),
  speaker_role text,
  detected_at timestamptz default now()
);
create index on lexical_flags(pid, signal_id);
create index on lexical_flags(detected_at desc);
```

**Detectors (write each with verified test cases):**

- **WS41 — self-sourcing intent (CRITICAL)**
  - EN: "book ourselves", "do it ourselves", "arrange myself", "handle this ourselves", "book directly", "we'll take care of", "we'll arrange"
  - HI: "khud kar lenge", "hum dekh lenge", "khud arrange", "khud le lenge", "hum book kar lenge"
  - Severity: critical (first instance)

- **WS42 — relationship carve-out**
  - If WS41 fires AND message contains: cousin, uncle, aunt, family friend, relative, "my [photographer/MUA/DJ/etc]", mama, chacha, bhua, mausi, mami, taya, dada, dadi, nana, nani, "rishtedaar"
  - Downgrade WS41 from critical → trend_watch

- **WS50 — CP/SP visible to client (CRITICAL)**
  - Detect commercial vocab in `source_group = 'client_group'` only: "cost price", "CP", "SP", "markup", "margin", "commission", "वेंडर रेट"
  - Severity: critical (trust risk)

- **WS43 — empaneled vendor**
  - "empaneled", "empanelled", "panel vendor", "venue's vendor", "venue panel", "panel ka", "venue ka vendor", "venue's preferred"
  - Severity: high
  - Any group

- **WS14 — cancellation language**
  - EN: "cancel", "not continue", "do not want to go ahead", "want to cancel", "back out", "stop the booking"
  - HI: "cancel kar rahe", "nahi chahiye", "nahi karna", "band karte hain", "rok dete hain"
  - Severity: critical
  - Client group only

- **WS15 — won't-pay / bulk payment**
  - EN: "won't pay", "will not pay", "withhold", "bulk payment", "cannot pay now", "no installments", "one shot only"
  - HI: "ek saath denge", "bulk mein", "abhi nahi denge", "ek baar mein"
  - Severity: high
  - Client group only

**T0.5 join:** Update `sop_flags` view to join in `lexical_flags`. T1 receives both as input.

**Detail panel UI:** Critical flags (WS14, WS41 without carve-out, WS50) render as red banner at top of detail panel, above StatusMeters. Include matched text + source group + speaker name.

**Acceptance:** Inject a test client-group message in any PID with "we'll just handle the photographer ourselves" — WS41 fires critical within one scrape cycle, banner renders. Add "my cousin is a photographer" — WS42 downgrades to trend_watch.

**Commit:** `feat(lexical): severity-1 lexical pre-pass — self-sourcing, CP/SP-in-client, empaneled, cancel, won't-pay`

---

## Step 4 — Source-aware signals + sender role tagging

**4.1 Migration `0013_signal_source_group.sql`:**

```sql
alter table signals add column source_group text;
update signals set source_group = case
  when wa_group_id in (select wa_group_id from pid_groups where group_type = 'internal') then 'internal_pid_group'
  when wa_group_id in (select wa_group_id from pid_groups where group_type = 'client') then 'client_group'
  when wa_group_id in (select wa_group_id from pid_groups where group_type = 'venue') then 'venue_group'
  else 'unknown'
end;
alter table signals alter column source_group set not null;
create index on signals(pid, source_group, ts desc);
```

(If your `pid_groups` table doesn't exist or uses different column names — verify schema first. Adjust the migration. Write a rollback in `0013_rollback.sql`.)

**4.2 Migration `0013b_sender_role.sql`:**

```sql
alter table signal_senders add column sender_role text;
-- backfill TL
update signal_senders set sender_role = 'tl' where sender_name = 'Amaan Abdul Kader' or sender_wa_id = '42975509885091:69@lid';
-- backfill planners/designers/PMs from known list
-- (write explicit updates per known wa_id from project_meragi_intel context)
-- mark uncertain
update signal_senders set sender_role = 'unknown' where sender_role is null;
```

Allowed values: `tl | planner | designer | pm | vm | client | client_family | venue_team | unknown`.

**4.3 T1 prompt updates:**

- Format chat lines as `[DATE] [SOURCE_GROUP] [ROLE] Name: body` instead of `[DATE] [internal] : body`.
- Add explicit instruction: "When describing a signal, reference its source group naturally. 'Bhavika asked the client on the client group' vs 'Bhavika confirmed the markup internally.' Same content in different groups can carry different severity."
- Encode the CP/SP-source inversion: "CP/SP/markup discussion in internal group = healthy commercial trail. Same content in client group = severity-1 trust risk."

**Acceptance:** Read a brief on a PID with both internal and client traffic. Brief explicitly references source group in at least 3 signals. CP/SP appearing in internal reads as "healthy" / "expected"; CP/SP in client reads as severity-1.

**Commit:** `feat(schema): source_group + sender_role columns + T1 source-aware framing`

---

## Step 5 — pid_state table (phase + recovery + heightened monitoring)

**Migration `0014_pid_state.sql`:**

```sql
create table pid_state (
  pid int primary key,
  phase text not null check (phase in (
    'sales_wip','onboarding','active_planning','mid_runway','final_quarter','post_event'
  )),
  runway_pct numeric,
  planning_started_at timestamptz,
  recovery_entered_at timestamptz,
  recovery_last_positive_marker_at timestamptz,
  recovery_sustained_positive boolean default false,
  heightened_monitoring_until timestamptz,
  updated_at timestamptz default now()
);
create index on pid_state(phase);
```

**Derivation function (runs nightly):**

- `phase`:
  - `sales_wip` if no planner assigned
  - `post_event` if `event_start_date < now() - interval '7 days'`
  - `onboarding` if planning_started < 14 days ago
  - `final_quarter` if `runway_pct >= 75`
  - `mid_runway` if `runway_pct >= 50`
  - `active_planning` otherwise
- `runway_pct` = `(now() - planning_started_at) / (event_start_date - planning_started_at)` × 100
- `planning_started_at` = first signal date in the PID's internal group after team assignment (fall back to `team_assigned_at` if no signals)

Recovery + heightened_monitoring stay null until manually set or computed by Step 13 state machine.

**Detail panel:**
- Phase pill at top (next to PID number): "ACTIVE PLANNING · 42% runway"
- Runway progress bar visible in header.
- If `recovery_entered_at` is not null and `recovery_sustained_positive = false`: red banner "Post-recovery vigilance — heightened monitoring."

**Acceptance:** All 33 PIDs have a `phase` and `runway_pct`. Phase pills render in detail panel. PID 24292 (post-event) shows `post_event`. PID 28438 (active) shows active_planning or mid_runway based on its actual runway.

**Commit:** `feat(state): pid_state table + phase pill + runway bar`

---

## Step 6 — Brief JSON v2 schema

**Find current Brief type:** `Grep "BriefJSON|brief_json|BriefSchema" type:ts`. Likely at `lib/types/brief.ts` or `scripts/whatsapp-scraper/types.ts`.

**Add fields:**

```typescript
type BriefJSON = {
  // ... existing fields (header, live tracker block, client pulse, etc.)

  phase: 'sales_wip'|'onboarding'|'active_planning'|'mid_runway'|'final_quarter'|'post_event';
  runway_pct: number;
  client_experience_frame: string | null;  // "Client is currently waiting on X"

  signals: Array<{
    text: string;
    source_group: 'internal_pid_group'|'client_group'|'venue_group';
    speaker: { name: string; role: string };
    severity: 'critical'|'high'|'medium'|'low';
    category: 'sentiment'|'collection'|'visibility'|'process'|'execution';
    client_visible: boolean;
    sop_id?: string;
    framework_source?: string;
    ts: string;
  }>;

  ai_clarification: Array<{
    question: string;
    reason: string;
    category: string;
  }>;

  amaan_self_loop: Array<{
    original_ask: string;
    asked_at: string;
    hours_unanswered: number;
    suggested_reping: string;
  }>;

  recovery_state: null | {
    entered_at: string;
    sustained_positive: boolean;
    last_positive_marker_at: string | null;
  };

  designer_lane: {
    assigned_designer: string | null;
    days_since_intro_call: number | null;
    design_surface_count: number;
    flag: string | null;
  };

  pm_lane: {
    assigned_pm: string | null;
    phase_role: 'early'|'late';
    client_group_messages_30d: number;
    meet_voice_count_30d: number;
    flag: string | null;
  };

  vm_lane: {
    open_requests: Array<{ tagged_at: string; topic: string; has_deadline: boolean; status_updates: number }>;
    flag: string | null;
  };

  commercial_trail: Array<{
    vendor_name: string;
    locked: boolean;
    cp_present: boolean;
    sp_present: boolean;
    advance_present: boolean;
    margin_present: boolean;
    schedule_present: boolean;
    completeness_pct: number;
  }>;

  phase_expectations: {
    expected_at_runway_pct: Array<{ item: string; expected: boolean; actual: boolean }>;
  };

  exceptional_pid_score: {
    proactive_surface: number;     // 0-1
    client_mirroring: number;      // 0-1
    collaborative_framing: number; // 0-1
    badge: boolean;                // true if sum > 2.0
  };
};
```

Update T1 prompt to emit these fields. Update detail panel to render them. Update markdown emission in `_vault-relink.ts` to reflect the new structure.

**Acceptance:** A regenerated brief on PID 28438 has all new fields populated. Detail panel renders without console errors. Vault markdown reflects new sections.

**Commit:** `feat(brief): JSON v2 schema — phase + state + lanes + clarification + self-loop + commercial trail`

---

## Step 7 — AI clarification subsection (Q/A with persistence)

**Migration `0015_brief_clarifications.sql`:**

```sql
create table brief_clarifications (
  id uuid primary key default gen_random_uuid(),
  pid int not null,
  brief_id uuid references briefs(id),
  question text not null,
  ai_uncertainty_reason text,
  amaan_answer text,
  answered_at timestamptz,
  applies_until timestamptz,
  category text,
  created_at timestamptz default now()
);
create index on brief_clarifications(pid, answered_at);
```

**T1 prompt:**
- Encourage emission of `ai_clarification[]` items when the AI is uncertain about: client sentiment direction, who owns an unclear next action, off-group movement that's suspected but unconfirmed, contradiction between tracker and chat, role of an unknown sender.
- On every run, T1 also receives unanswered + recently-answered (last 30 days) clarifications for that PID as context. Answered ones inform future inference; unanswered ones get re-asked if still uncertain.

**Pipeline:** When T1 emits clarifications, each becomes a row in `brief_clarifications`.

**Detail panel:** New section "What I don't know" with inline textarea per question + Save button. POST to `/api/clarification-answer` writes `amaan_answer` + `answered_at`.

**Acceptance:** A brief emits ≥1 clarification. Amaan answers via panel. Next-day brief no longer asks the same question (or re-asks with updated framing referencing the prior answer).

**Commit:** `feat(brief): AI clarification Q/A — schema + UI + T1 prompt integration`

---

## Step 8 — Cross-group context suppression (WS49)

**Logic:** Before T1 flags a client-group signal, check the internal group for the same PID within a 72h window for an explanatory note.

**Postgres function:**

```sql
create or replace function find_internal_explanation(
  p_pid int,
  p_topic text,
  p_client_signal_ts timestamptz
) returns text as $$
  -- search internal group signals 72h before client signal
  -- for topic-matching explanatory content
  -- returns matched text or null
$$ language sql;
```

Implementation: simple keyword overlap or LLM-assisted topic match — but keep deterministic for v1. Match nouns + sentiment direction.

**T1 prompt rule:**
> "Before flagging anything happening on the client group, check whether the internal group has explained it within the last 72 hours. If a planner has noted 'Priya is unwell, returning Monday' internally, design slowness on the client group should be surfaced as explained, not flagged. Format: 'Design pause is explained internally: Priya unwell, back Monday.' Do not flag what has already been explained."

**Acceptance:** Inject an internal-group note "designer Priya unwell, back Monday" and a client-group complaint "no moodboard yet" — T1 surfaces the explanation, does not flag the client-group complaint.

**Commit:** `feat(t1): cross-group context suppression — internal notes de-flag client signals`

---

## Step 9 — Amaan-asks-self-loop (WS47)

**Identify Amaan's asks:** internal-group messages from TL_WA_ID that end in `?` or contain interrogative patterns ("can we", "are we", "what's the", "any update", "EOD?").

**Check team response:** any substantive (>10 chars, non-emoji) message in the same group from a non-Amaan sender within 24h after the ask.

**View:**

```sql
create or replace view amaan_unanswered_asks as
select
  s.pid,
  s.id as ask_signal_id,
  s.body as ask_text,
  s.ts as asked_at,
  extract(epoch from (now() - s.ts))/3600 as hours_unanswered
from signals s
where s.sender_wa_id = '42975509885091:69@lid'  -- or read from env
  and s.source_group = 'internal_pid_group'
  and (s.body like '%?%' or s.body ~* 'can we|are we|any update|EOD|on track')
  and not exists (
    select 1 from signals r
    where r.pid = s.pid
      and r.source_group = 'internal_pid_group'
      and r.sender_wa_id != s.sender_wa_id
      and r.ts > s.ts
      and r.ts <= s.ts + interval '24 hours'
      and length(r.body) > 10
  )
  and s.ts > now() - interval '7 days';
```

(Adjust column names to actual schema.)

**T1 emits `amaan_self_loop[]`:** each item has `original_ask`, `asked_at`, `hours_unanswered`, `suggested_reping` (soft-tone follow-up referencing original ask).

**Detail panel:** "Still waiting on" section. Shows Amaan's unanswered asks + soft re-ping draft per row.

**Acceptance:** PID 28438 (or any PID with a TL ask > 24h old in the internal group) shows the self-loop row with a usable re-ping draft.

**Commit:** `feat(brief): Amaan-asks-self-loop — surface unanswered TL asks at 24h+`

---

## Step 10 — Role lanes (Designer + PM + VM)

Compute per-PID and surface in brief + detail panel.

**Designer lane (from § 16 of handoff):**
- Assigned designer
- Days since intro call
- `design_surface_count` — count of designer-originated messages on client group containing design vocabulary: moodboard, decor brief, save-the-date, monogram, invite, printable, stationery, theme
- **Flag:** if days >= 28 AND count = 0 (WS36)
- **Address:** internal PID group, directly to designer (not via planner)

**PM lane:**
- Assigned PM
- `phase_role`: 'early' (before venue recce) or 'late' (venue recce onward)
- `client_group_messages_30d`
- `meet_voice_count_30d` (from Gemini transcripts if available, else 0)
- **Flags:**
  - Early phase + 30d count = 0 → light slip (WS37 medium)
  - Late phase + venue recce ≤ 30d + count = 0 → severity-up (WS37 high)
  - meet_voice_count_30d = 0 → flag (WS38)

**VM lane (Monu):**
- Open VM requests (where planner or PM tagged VM with a vendor request and VM hasn't closed it)
- For each request: `has_deadline` (VM's response committed a date), `status_updates` (count of proactive updates from VM)
- **Flags:**
  - Request open + VM responded without deadline → WS39 medium
  - Request past committed deadline + 0 status updates → WS40 high
  - Per-VM-person chronic delay pattern across PIDs → portfolio-level flag in T3

Surface as collapsible lanes in detail panel.

**Acceptance:** PID with an unassigned designer (Anant's) shows designer_lane.flag if client decor intent or venue recce coincide. PID with a VM open request shows vm_lane status.

**Commit:** `feat(brief): designer + PM + VM role lanes`

---

## Step 11 — Normalize 36 SOPs to `sops` table

**Migration `0016_sops_table.sql`:**

```sql
create table sops (
  sop_id text primary key,         -- 'SOP-01' through 'SOP-36'
  stage text not null,
  package_tier text default 'All',
  role text not null,
  category text not null,
  title text not null,
  body text not null,
  framework_source text,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index on sops(stage, role);
create index on sops(framework_source);
```

**Seed:** Insert all 36 SOPs from § 18 of the Phase 1 handoff verbatim. Match `framework_source` exactly to file names in `C:\Users\Amaan\Obsidian\Meragi-Intel\frameworks\`.

**Sync script:** `scripts/sync-sops-from-vault.ts` — one-way (vault is authoritative). Reads `sops/*.md` markdown if/when vault `sops/` folder is populated; for now seeds directly from handoff § 18.

**Acceptance:** `select count(*) from sops` returns 36. Every row has a framework_source. The SOP table is queryable by phase + role for T2.5.

**Commit:** `feat(sops): normalized sops table seeded with 36 SOPs from Phase 1 interview`

---

## Step 12 — T2.5 SOP critic tier (Sonnet)

**New file:** `scripts/whatsapp-scraper/t2-5-sop-critic.ts`.

**Triggered when** any of (T0.5 sop_flags, lexical_flags) marks a PID with severity ≥ medium. Expected volume: 8-15 PIDs/day.

**Loads per PID:**
- Today's brief (full BriefJSON v2)
- Relevant SOPs from `sops` table (filtered by `phase` + `role` + active=true)
- Last 7 days of source-aware signals
- Open clarifications + recently-answered clarifications
- Framework references for the cited SOPs

**Model:** Sonnet 4.6. Temperature 0.2.

**Output:** Structured JSON written to `brief_sop_critique` table:

```sql
create table brief_sop_critique (
  id uuid primary key default gen_random_uuid(),
  brief_id uuid references briefs(id),
  pid int not null,
  violations jsonb not null,  -- [{ sop_id, severity, evidence, ladder_step }]
  exceptional_markers jsonb,  -- [{ axis, evidence }]
  ladder_recommendation text, -- 'monitor' | 'internal_nudge' | 'direct_call' | 'tl_visible'
  created_at timestamptz default now()
);
```

**Critique rules (from § 19 + § 24 of handoff):**
- Cite specific SOP IDs being violated, with evidence text + source group.
- Suggest ladder step: monitor / internal nudge / direct call / TL visible. Never founder escalation.
- Never draft messages — surface state and ladder step.
- Allowed to surface exceptional markers when proactive surface + mirroring + collaborative framing all present.

**Detail panel:** Render as new section below NEEDS YOU: "SOP critique" with violations grouped by severity + ladder recommendation.

**Cost target:** ~₹40/day for ~10 PIDs.

**Acceptance:** T2.5 runs on PID 32245 (which has unacknowledged_requests per memory) — cites SOP-04 (substantive ask not acknowledged within 1 day) with evidence. Surfaces ladder step = internal_nudge.

**Commit:** `feat(t2-5): SOP critic tier (Sonnet) on flagged PIDs`

---

## Step 13 — State machines

### 13.1 Post-recovery vigilance

When `pid_state.recovery_entered_at` is set (manually or by T2.5 detecting recovery-call signals), the daily job runs:

- Check client group signals over 7 rolling days
- Count positive markers: praise, client-initiated thanks, client-initiated plans/excitement
- Count negative-tone messages: complaints, frustration, "delay" patterns
- If ≥3 positive markers AND 0 negative-tone over 7 days → set `recovery_sustained_positive = true`, clear `heightened_monitoring_until`

While `recovery_sustained_positive = false`:
- Detail panel banner: red "Post-recovery vigilance — heightened monitoring"
- T1 elevates severity for visibility gaps, missing MOMs, silent stretches

### 13.2 Active-but-ineffective planner diagnostic

Rolling 30d metric per planner (across their PIDs):

- `collection_movement_pace_vs_runway_curve`: weighted avg of (collection_pct gained / runway_pct gained) across active PIDs
- `vendor_closure_pace_vs_runway_curve`: weighted avg of vendors locked vs expected at this runway %
- `self_sourcing_signal_count_30d`: rolling WS41 count across planner's PIDs

If `message_activity_30d` is high (top quartile) but two of the three outcome metrics lag the expected curve → flag `active_but_ineffective = true` for that planner.

Surface in T3 portfolio brief, not in per-PID briefs.

**Commit:** `feat(state): post-recovery vigilance + active-but-ineffective diagnostic`

---

## Step 14 — Post-event hygiene (WS46)

Ensure `phase = 'post_event'` PIDs are excluded from Projects table default view, "Important" filter, and dashboard "Top of Mind."

Surface in a separate "Post-event" view (low priority, opacity 0.55 already in place).

This is mostly a query change: add `and pid_state.phase != 'post_event'` to the queries powering those views. Find via `Grep "ALL_AMAAN_PIDS|projects.select" type:ts`.

**Acceptance:** PID 24292 (past event) does not appear in Projects pending/important. Appears in post-event view.

**Commit:** `fix(views): exclude post_event PIDs from pending + important`

---

## Step 15 — Exceptional PID scoring

Compute per-PID from last 30 days of chat signals:

- `proactive_group_surface_score` (0-1): proportion of planner-originated client-group messages that include detail (>50 chars, contain specifics) relative to total planner messages
- `client_mirroring_score` (0-1): cosine similarity (approximate) between planner register and client register across the period — proxy via message length distribution match
- `collaborative_problem_framing_score` (0-1): proportion of problem-framing messages from the team that use "we" / "together" / "let's figure out" vs apologetic / defensive framing

Surface `exceptional_pid_score.badge = true` when sum > 2.0.

Seed positive examples: Anant's PIDs. Score them first as ground truth, tune weights so they all land in the badge zone.

Detail panel: gold star badge on PID header when `badge = true`.

T3 portfolio brief: separate section "Exceptional PIDs this week" listing badged PIDs.

**Commit:** `feat(score): exceptional PID scoring (proactive + mirroring + collaborative)`

---

## Step 16 — Eval pack + AI vs Phase 1 brain comparison

**Create `evals/phase-1-pids.md`:**

Pick one PID per archetype below. Document each pick with PID + 1-line justification.

| Archetype | Expected behavior |
|---|---|
| Exceptional (one of Anant's) | Exceptional badge fires; no risk flags |
| Client silence (Kerala-style from § 8) | "Client engagement risk" classification, not planner failure; payment escalation flag |
| Bhavika collection lag | Outcome-gated active-but-ineffective flag; SOP-13/14/15 violations cited |
| Aditya off-group visibility gap | Group-summary nudge to Aditya (no planner-blame); SOP-09 violation |
| Self-sourcing language in chat (synthetic if no real instance) | WS41 fires critical, banner in detail panel |
| Sentiment-driven cancellation risk (34656 or analog) | Watch flag, no auto-escalation, no founder draft |
| Tapasya baseline (control) | No person-level flag; only role-level flags if applicable |
| Post-event PID (24292) | Excluded from pending/important; opens in post-event view |

**Run T1 + Step 3 lexical + T2.5 + T3** on the eval pack.

**Score manually** in `evals/phase-1-evaluation.md`:
- ✅ / ❌ for each expected behavior
- Note over-flags (false positives) + under-flags (false negatives)
- Categorize misses: prompt issue / data issue / SOP issue / threshold issue

This becomes the input for the weekly improvement cycle.

**Commit:** `eval: Phase 1 archetype pack + manual evaluation`

---

## Step 16.5 — Portfolio tab inside dashboard

Surface T3 portfolio brief as a tab in the existing dashboard shell, alongside Projects / Team / Coplanner / Settings.

**Find existing tab nav:** `Grep "Projects.*Team.*Coplanner|TabsList|nav-tab" type:tsx` to locate the nav component.

**New page:** `app/(app)/portfolio/page.tsx` (server component).

**Data source:** today's row from `portfolio_briefs` table (most recent by `created_at desc`). Date picker for viewing history (last 30 days).

**Sections rendered (from T3 structured output):**
- Patterns
- Outliers
- Predicted escalations
- Exceptional PIDs (new from Step 15)
- Active-but-ineffective planners (new from Step 13)
- Post-recovery cohort (new from Step 13)

Each section expandable. PID chips link to existing detail panel route.

**Mobile-first:** Amaan reads on phone. Single-column layout, larger tap targets, sticky date header. Use existing design tokens — don't introduce new CSS variables.

**Acceptance:** Tab appears in dashboard nav. Today's portfolio brief renders. Phone-width viewport (375px) renders without horizontal scroll. PID chip taps open detail panel.

**Commit:** `feat(portfolio): portfolio tab in dashboard reading T3 brief`

---

## Step 17 — Fresh scrape + integration + merge + deploy

**17.1 Fresh full-pipeline scrape on the new architecture.** Run end-to-end:

```powershell
cd C:\Users\Amaan\Projects\meragi-intel\scripts\whatsapp-scraper
pnpm start                              # WhatsApp scrape, ~30-45 min
npx tsx resolve-senders.ts              # resolve new senders
npx tsx lexical-flags.ts                # NEW from Step 3
npx tsx generate-brief.ts --all-mine    # T1 with all new schema
npx tsx t1b-feedback-match.ts           # existing
npx tsx t2-5-sop-critic.ts              # NEW from Step 12
npx tsx t3-portfolio-brief.ts           # T3 with exceptional + active-but-ineffective + recovery cohort
```

Cost estimate: scrape free, T1 ~₹33, T2.5 ~₹40, T3 ~₹41. Total ~₹115.

Verify:
- All 33 PIDs have new-schema briefs (`phase`, `runway_pct`, `client_experience_frame`, `ai_clarification[]`, `amaan_self_loop[]`, `recovery_state`, lanes, commercial_trail).
- Detail panel renders all new sections without console errors.
- Portfolio tab loads today's brief.
- Lexical pre-pass fired on at least one PID with a hit (if any exist in the scrape window).

**17.2 Write session note** at `C:\Users\Amaan\Obsidian\Meragi-Intel\sessions\<finish-date>.md`:
- What shipped (commits by step, with hashes).
- What didn't ship + why (PHASE-1-BLOCKERS.md + PHASE-1-OPPORTUNITIES.md content).
- Known limitations + suggested first weekly-improvement-cycle target.
- Eval pack scoring summary.

**17.3 Update memory:**
- `project_phase2_progress.md`: new top section "Update <finish-date> — Phase 1 execution complete."
- `MEMORY.md` index: update the project_phase2_progress one-liner.

**17.4 Push `phase-1-execution` to remote.** Single push, all commits.

```powershell
git push -u origin phase-1-execution
```

**17.5 Merge to `main` locally with `--no-ff` + push.**

```powershell
git checkout main
git pull
git merge --no-ff phase-1-execution -m "merge: Phase 1 execution"
git push origin main
```

**17.6 Notify Amaan to reconnect Vercel auto-deploy** on the dashboard (project `meragi-space` → Git → reconnect). If reconnection is delayed, fallback: `vercel --prod` from CLI on main branch.

**17.7 Verify deploy on `meragi.space`** — Amaan checks from phone:
- Detail panel renders all new sections.
- Portfolio tab loads.
- At least one lexical-flag banner if any PIDs hit (synthetic test PID may be needed if no real hits).
- Phase pills visible on PID rows.

Wait for Amaan's "looks good on phone" confirmation before considering done.

---

## What's explicitly NOT in this execution

These are Phase 2 work, deferred to pre-November:

- Master sheet analysis layer (depends on master sheet access/extraction)
- Planner-side dashboard (different framing of same data)
- Coplanner-for-planners (expert system, junior planners as audience)
- Coplanner-for-TLs (read-only portfolio query layer)
- Monthly team-rollup report
- Post-event SOP set (closer to November)
- Phase 2 emotional/judgment interview blocks (per § 22 of handoff)

If you find yourself building one of these, STOP. Out of scope.

---

## Acceptance criteria for "done"

All of:
- All 17 steps committed on `phase-1-execution` branch.
- Eval pack run with manual scoring committed at `evals/phase-1-evaluation.md`.
- Detail panel renders all new sections without console errors.
- Nightly pipeline runs end-to-end without errors.
- T1 brief on a sample PID reads as a continuation of yesterday's conversation, not a fresh template.
- AI clarification has at least one Amaan-answered entry persisting into next-day brief.
- Self-sourcing test message in any client group triggers WS41 critical banner within one scrape cycle.
- `sessions/<finish-date>.md` written.
- Memory updated.

---

## Notes for the Sonnet executing this

- Amaan is non-engineer. Don't dump verbose explanations into commits or session notes — keep them operator-grade.
- He uses Obsidian as the canonical knowledge surface; markdown emission and wikilinks matter as much as DB rows.
- The vault structure is at `C:\Users\Amaan\Obsidian\Meragi-Intel\` — see `reference_vault_structure` memory.
- He has a hard "no relitigating locked decisions" preference — if a step contradicts the Phase 1 handoff, stop and write to PHASE-1-BLOCKERS.md, don't deviate.
- When in doubt about scope: the Phase 1 handoff is binding. Anything not in it is Phase 2.
- The brief is the customer-facing surface. If the brief reads worse after a change, revert and re-think.
