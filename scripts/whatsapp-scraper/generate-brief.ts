import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { z } from 'zod';
import { config } from 'dotenv';
import { resolve } from 'path';
import { writeFileSync, mkdirSync } from 'fs';
import { ALL_AMAAN_PIDS as ALL_AMAAN_PIDS_RO } from '../../lib/static/all_pids';
import { todayIstYmd, briefDateCutoff } from '../../lib/utils/brief-date';

config({ path: resolve(process.cwd(), '../../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

if (!process.env.DEEPSEEK_API_KEY) {
  console.error('DEEPSEEK_API_KEY not set in .env.local');
  process.exit(1);
}

const deepseek = new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: 'https://api.deepseek.com' });

const VAULT_PATH =
  process.env.VAULT_PATH ?? 'C:\\Users\\Amaan\\Obsidian\\Meragi-Intel';

const ALL_AMAAN_PIDS = [...ALL_AMAAN_PIDS_RO];

// --- CLI args ---
const args = process.argv.slice(2);
const isCatchup = args.includes('--catchup');
const allMine = args.includes('--all-mine');
const pidArg = args.find((a) => a.startsWith('--pid='))?.replace('--pid=', '');
const dateArg = args.find((a) => a.startsWith('--date='))?.replace('--date=', '');

let targetPids: number[];
if (pidArg) {
  targetPids = [parseInt(pidArg, 10)];
} else if (allMine) {
  targetPids = ALL_AMAAN_PIDS;
} else {
  console.error('Usage: npx tsx generate-brief.ts --all-mine [--catchup]');
  console.error('       npx tsx generate-brief.ts --pid=24292 [--catchup]');
  process.exit(1);
}

// --- Types ---

// Phase from pid_state. Mirrors the migration 0013 check constraint.
type PidPhase =
  | 'sales_wip'
  | 'onboarding'
  | 'active_planning'
  | 'mid_runway'
  | 'final_quarter'
  | 'post_event'
  | 'paused'
  | 'cancelled';

// What Haiku emits. Constrained by BRIEF_SCHEMA below.
interface HaikuBriefOutput {
  client_pulse: {
    sentiment: 'positive' | 'neutral' | 'cautious' | 'anxious' | 'cold';
    confidence: 'high' | 'medium' | 'low';
    summary: string;
    days_silent: number;
  };
  team_status: Array<{
    display_label: string;
    role: string;
    last_active_date: string;
    activity_note: string;
  }>;
  what_changed: string[];
  commitments: Array<{
    what: string;
    owner: string;
    due: string;
    status: 'open' | 'done' | 'overdue' | 'unclear';
  }>;
  needs_you: Array<{
    headline: string;
    detail: string;
    priority: 'urgent' | 'soon' | 'when_able';
    risk_type?: 'sentiment' | 'collection' | 'visibility' | 'process' | 'execution' | 'cancellation';
  }>;
  unacknowledged_requests: Array<{
    request: string;
    verbatim?: string;
    asked_by: string;
    asked_on: string;
    days_unanswered: number;
  }>;
  open_questions: {
    clarification_message: string;
  };
  cross_source_flags: Array<{
    flag: string;
    chat_says: string;
    tracker_says: string;
  }>;
  // New model-emitted fields (Brief JSON v2)
  client_experience_frame: string;
  ai_clarification: Array<{
    question: string;
    reason: string;
    category: 'sentiment' | 'payment' | 'team' | 'vendor' | 'other';
  }>;
  vendor_coverage: Array<{
    vendor_type: string;
    vendor_name: string;
    status: 'confirmed' | 'pending' | 'at_risk' | 'unknown';
    last_mentioned: string;
    note: string;
  }>;
  decision_intel: {
    pending_decisions: Array<{
      decision: string;
      owner: string;
      deadline: string;
      blocking: boolean;
    }>;
    recent_decisions: Array<{
      decision: string;
      decided_by: string;
      decided_on: string;
    }>;
  };
}

// Final persisted brief = Haiku output + deterministic computed fields.
interface BriefJSON extends HaikuBriefOutput {
  phase: PidPhase;
  runway_pct: number | null;
  recovery_state: null | {
    entered_at: string;
    sustained_positive: boolean;
    last_positive_marker_at: string | null;
  };
  amaan_self_loop: Array<{
    original_ask: string;
    asked_at: string;
    hours_unanswered: number;
    suggested_reping: string;
  }>;
  designer_lane: {
    assigned_designer: string | null;
    days_since_intro_call: number | null;
    design_surface_count: number;
    flag: string | null;
  };
  pm_lane: {
    assigned_pm: string | null;
    phase_role: 'early' | 'late' | 'na';
    client_group_messages_30d: number;
    meet_voice_count_30d: number;
    flag: string | null;
  };
  vm_lane: {
    open_requests: Array<{
      tagged_at: string;
      topic: string;
      has_deadline: boolean;
      status_updates: number;
    }>;
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
    expected_at_runway_pct: Array<{
      item: string;
      expected: boolean;
      actual: boolean;
    }>;
  };
  exceptional_pid_score: {
    proactive_surface: number;
    client_mirroring: number;
    collaborative_framing: number;
    badge: boolean;
  };
}

// --- JSON schema for output_config ---
const BRIEF_SCHEMA = {
  type: 'object',
  properties: {
    client_pulse: {
      type: 'object',
      properties: {
        sentiment: { type: 'string', enum: ['positive', 'neutral', 'cautious', 'anxious', 'cold'] },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        summary: { type: 'string' },
        days_silent: { type: 'integer' },
      },
      required: ['sentiment', 'confidence', 'summary', 'days_silent'],
      additionalProperties: false,
    },
    team_status: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          display_label: { type: 'string' },
          role: { type: 'string' },
          last_active_date: { type: 'string' },
          activity_note: { type: 'string' },
        },
        required: ['display_label', 'role', 'last_active_date', 'activity_note'],
        additionalProperties: false,
      },
    },
    what_changed: { type: 'array', items: { type: 'string' } },
    commitments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          what: { type: 'string' },
          owner: { type: 'string' },
          due: { type: 'string' },
          status: { type: 'string', enum: ['open', 'done', 'overdue', 'unclear'] },
        },
        required: ['what', 'owner', 'due', 'status'],
        additionalProperties: false,
      },
    },
    needs_you: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          headline: { type: 'string' },
          detail: { type: 'string' },
          priority: { type: 'string', enum: ['urgent', 'soon', 'when_able'] },
          risk_type: { type: 'string', enum: ['sentiment', 'collection', 'visibility', 'process', 'execution', 'cancellation'] },
        },
        required: ['headline', 'detail', 'priority'],
        additionalProperties: false,
      },
    },
    unacknowledged_requests: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          request: { type: 'string' },
          verbatim: { type: 'string' },
          asked_by: { type: 'string' },
          asked_on: { type: 'string' },
          days_unanswered: { type: 'integer' },
        },
        required: ['request', 'verbatim', 'asked_by', 'asked_on', 'days_unanswered'],
        additionalProperties: false,
      },
    },
    open_questions: {
      type: 'object',
      properties: {
        clarification_message: { type: 'string' },
      },
      required: ['clarification_message'],
      additionalProperties: false,
    },
    cross_source_flags: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          flag: { type: 'string' },
          chat_says: { type: 'string' },
          tracker_says: { type: 'string' },
        },
        required: ['flag', 'chat_says', 'tracker_says'],
        additionalProperties: false,
      },
    },
    client_experience_frame: { type: 'string' },
    ai_clarification: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          reason: { type: 'string' },
          category: { type: 'string', enum: ['sentiment', 'payment', 'team', 'vendor', 'other'] },
        },
        required: ['question', 'reason', 'category'],
        additionalProperties: false,
      },
    },
    vendor_coverage: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          vendor_type: { type: 'string' },
          vendor_name: { type: 'string' },
          status: { type: 'string', enum: ['confirmed', 'pending', 'at_risk', 'unknown'] },
          last_mentioned: { type: 'string' },
          note: { type: 'string' },
        },
        required: ['vendor_type', 'vendor_name', 'status', 'last_mentioned', 'note'],
        additionalProperties: false,
      },
    },
    decision_intel: {
      type: 'object',
      properties: {
        pending_decisions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              decision: { type: 'string' },
              owner: { type: 'string' },
              deadline: { type: 'string' },
              blocking: { type: 'boolean' },
            },
            required: ['decision', 'owner', 'deadline', 'blocking'],
            additionalProperties: false,
          },
        },
        recent_decisions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              decision: { type: 'string' },
              decided_by: { type: 'string' },
              decided_on: { type: 'string' },
            },
            required: ['decision', 'decided_by', 'decided_on'],
            additionalProperties: false,
          },
        },
      },
      required: ['pending_decisions', 'recent_decisions'],
      additionalProperties: false,
    },
  },
  required: [
    'client_pulse', 'team_status', 'what_changed', 'commitments', 'needs_you',
    'unacknowledged_requests', 'open_questions', 'cross_source_flags',
    'client_experience_frame', 'ai_clarification', 'vendor_coverage', 'decision_intel',
  ],
  additionalProperties: false,
};

// --- System prompt (cached across all PID calls in a run) ---
const SYSTEM_PROMPT = `You generate daily project intelligence briefs for Amaan, Team Lead at Meragi Celebrations — an Indian destination wedding company. Amaan manages 4 sub-teams across destination weddings.

## Your job
Read the project context (hard facts from the tracker) and WhatsApp chat signals (from the client group and internal planning group), then produce a structured JSON brief. Your goal is TL-level judgment — what Amaan would think, not what a checklist would output.

## Operating model (the five conceptual shifts)
1. Source-aware framing. Every signal exists in either the internal PID group, the client group, or a venue group. Same content can carry very different severity by source — internal CP/SP discussion is healthy commercial trail; client-visible CP/SP is a severity-1 trust risk. When you describe a signal, mention source naturally and reason about severity by source.
2. Two-axis triage. Macro ranking: cancellation > sentiment > payment > team-unassigned. Intra-day filter: what the client is currently feeling/waiting on. A flag the client is actively annoyed by jumps the queue even if category is lower. Client-experienced flags first; hidden process flags below.
3. Continuity. Today's draft continues yesterday's conversation. If a prior ask is unanswered, reference it — never restart with a fresh "what's the update".
4. AI uncertainty is first-class. Reflect what you don't know in summaries and confidence. Confident bad calls are worse than admitted uncertainty.
5. State over chat. Consider runway position and PID lifecycle. A first-quarter PID without DJ is fine; a final-quarter PID without DJ is critical.

## Hard rules
1. NEVER assert payment amounts, package prices, GMV, or exact dates as facts derived from chat — these come only from the tracker fields labelled "TRACKER:".
2. EVERY soft-signal claim (client_pulse summary, what_changed items, commitment owner, etc.) must end with [Display Label, DD MMM] attribution showing who said it and when. Exception: if a speaker is only identified by a raw @lid string (e.g. digits followed by @lid) or shows as "Unknown" or "?", OMIT the attribution suffix rather than guessing — an unattributed claim is better than a wrongly-attributed one.
2b. team_status[].display_label is the PERSON NAME ONLY (e.g. "Bhavika Gurnani" or "Bhavika"). Do NOT include a role suffix "(Planner)" / "(Designer)" / "(PM)" inside team_status display_label — the role field is appended separately at render time and duplicates show as "Bhavika (Planner) (Planner)" in the final markdown. The role belongs only in the team_status.role field.
3. If evidence is thin (e.g. only 2 messages), reflect low confidence. Do not pad sections.
4. COMMITMENTS: extract only explicit promises ("I'll send X by Friday", "We'll confirm by Monday"). Not vague intentions.
4b. UNACKNOWLEDGED REQUESTS — most critical category. List every client message in the chat window that contains a request, a question, or a decision the team has to make, where there is no team reply within 24 hours of the client message. For each entry: "request" = a one-line paraphrase, "verbatim" = the EXACT quote from the client's message (copy verbatim, do not paraphrase), "asked_by" = client display label, "asked_on" = DD MMM, "days_unanswered" = whole days from the client message to TODAY. If everything has been answered, return an empty array. Do NOT skip entries because they seem minor — an unanswered client is the highest-priority signal. A "request" is also when the client provides a piece of information that needs an acknowledgement, not just an explicit question. CRITICAL — DEFLECTION IS NOT AN ANSWER: a team reply like "we are working on it", "waiting for vendor confirmation", "will share soon", "let me check and revert", or any holding response that does NOT actually deliver what the client asked for, does NOT close the unack entry. The request stays in the unack list until the actual thing the client asked for is delivered (profile shared, call time confirmed, decision made, document sent). MIRROR RULE: if you wrote a needs_you item containing phrases like "client waiting", "unanswered Nd", "request from [client] not addressed", or "[client] asked X but no response" — the SAME issue MUST also appear as an unacknowledged_requests entry. needs_you and unacknowledged_requests are NOT alternatives — needs_you tells Amaan what to do; unack lists what the client is actively waiting on. The same client-side ask appears in BOTH sections. Use the client's first name (e.g. "Dharmik") as asked_by — do NOT include role suffix or partner names.
5. OPEN QUESTIONS: compose a SINGLE WhatsApp message for Amaan to send to the internal group. Rules:
   (a) Always open with "Hey Team," — NEVER address a specific planner by name. Amaan sends to the whole team.
   (b) On the second line add: "If any of these were discussed on call, please ensure there's a text trail." — always include this.
   (c) Then a numbered list of action points. Keep each point SHORT — one line, direct. Do not explain the history ("on 1 May we didn't respond for 10 days" is forbidden — just ask for the status). Format: "1. [Topic] — [one-line ask]"
   (d) Every point must be a DIRECTIVE, never a question back at Amaan ("should we do X?" is forbidden — replace with "please confirm X" or "status on X?").
   (e) If a cx message was ignored, state it plainly and ask for the resolution — do not soften.
   (f) If collection is low and no payment has moved, include the exact collected amount (from TRACKER) and ask when the next instalment is expected.
   (g) No emojis, no warm padding, no verbose context. Amaan edits these down — give him the tight version to start.
   (h) If there is nothing to clarify, set clarification_message to an empty string.
   (i) CONTINUITY — if Amaan asked something in the internal group in a prior brief and the team hasn't substantively responded, today's point references that prior ask: "Guys, still waiting on a response on X" or "any movement on the Y I asked about yesterday?" Do NOT restart conversations with fresh "what's the update on X" when X was already asked.
6. CROSS-SOURCE FLAGS: raise a flag when chat clearly contradicts a tracker field, OR when commercial vocabulary (CP, SP, markup, margin, commission) appears in the CLIENT group — that is a severity-1 trust risk regardless of tracker state. Do not flag speculative differences.
7. NEEDS YOU: surface only things that genuinely require Amaan's decision or action. Each item has a "headline" (<15 words, TL-scannable) and a "detail" (full explanation with attribution). Tag each with a "risk_type" from: sentiment, collection, visibility, process, execution, cancellation. Order client-experienced flags first.
8. ATTRIBUTION OF BLAME: separate client engagement risk from planner ownership failure. If the client is silent but the planner has been proactive and followed up, do NOT frame this as a planner issue. Blame must match evidence.
9. OVER-FLAGGING: do not flag isolated words like "delay" or "waiting" as risk signals. Tie severity to: repetition, blame pattern, payment proximity, event proximity, and whether the team broke a communication loop.
10. FLAG FRAMING: when raising any flag in needs_you or client_pulse, name which risk it represents — sentiment risk, collection risk, visibility risk, process risk, or execution risk. This helps Amaan triage.
11. ACTION LADDER: use the lowest-appropriate intervention level — in ascending order: monitor, internal nudge, direct planner call, client-group entry, team reassignment. NEVER suggest founder escalation in the brief; sentiment-driven cancellation risk and pricing-wall escalation are synthesized by Amaan, not the AI.
12. PRAISE: avoid generic positive observations ("the team has been responsive"). Only include a positive note if it is specific, actionable, and relevant to a risk Amaan is tracking.
13. DATE REFERENCES: TODAY is ONLY the brief_date shown at the top of the user prompt after "TODAY:". NEVER use the word "today" to refer to a past commitment deadline, a chat message date, or any other date. If a deadline has passed, say "was due [DD MMM] ([N] days ago)" — never "was due today". If something happened in chat on a specific date, attribute it as "[DD MMM]" or "[N days ago]". The only time "today" is correct is for actions Amaan should take right now, on the brief_date. Use only the N-day values pre-computed in CHAT SIGNALS (shown as "— Nd ago" in the timestamp brackets). Do not recompute or estimate day counts from raw dates.
14. LENGTH — short. Multi-item stacking is fine but each item brief. No jargon, no corporate register, no American-corporate phrasing. Operator-grade.
15. SHARPNESS IS NEVER IN THE DRAFT — if a situation calls for sharper energy than the soft register supports, surface "this may need a direct call" in needs_you. Never write the sharper version in clarification_message.
16. DIRECT-CALL TRIGGER — flag a candidate direct call when Amaan has nudged twice in the group on the same item without team response AND a third public follow-up would damage the visible thread's optics. Count + thread-optics, not count alone.
17. SOURCE-AWARE FRAMING — when describing a signal, reference its source naturally. "Bhavika asked the client on the client group" vs "Bhavika confirmed the markup internally." Same content + different group = different severity.
18. CROSS-GROUP CONTEXT CAN DE-FLAG — an internal-group note can re-frame a client-group signal. Example: design slowness on the client group is NOT a slip if the internal group has explained why (designer unwell, returning Monday). Do not flag what has already been explained internally.
19. NO ESCALATION DRAFTS — never draft founder-bound escalation packets, hard-refusal scripts for the client group, recovery scripts (credentials → apology → reframe → action), or sharper-tone messages. Surface the state and ladder step; let Amaan write the response.
20. DETERMINISTIC FLAGS ARE MANDATORY. The "=== DETERMINISTIC FLAGS ===" section in the user prompt lists lexical pre-pass hits already verified against project chat. EVERY CRITICAL flag listed there MUST surface in your output — either as a "cross_source_flags" entry (for source-mismatch / commercial-leak) or as a "needs_you" item with the matching risk_type (cancellation for WS41 self-sourcing, process for WS50 CP/SP leak, process for WS14/WS15 cancel/won't-pay, visibility for WS43 empaneled-vendor). HIGH severity flags should surface unless the chat context already explains them away (see rule 18). Do not silently drop a deterministic flag.

## WS41 — Self-sourcing risk
If the client signals intent to source a vendor themselves — phrases like "we'll handle X ourselves", "we'll book Y directly", "we're going to arrange Z on our own", or Hinglish equivalents ("khud kar lenge", "hum le lenge", "apne aap karenge") — this is a severity-1 trust collapse from first instance, not after repetition. Surface in "needs_you" with risk_type: cancellation and priority: urgent. Carve-out: if the same message names a family relationship (cousin, uncle, brother-in-law, mama, chacha, family friend, "my brother", "family knows them"), downgrade to a "cross_source_flags" entry for trend-watching only — relationship vendors are not a vote of no confidence.

## Required additional fields (Brief JSON v2)

Beyond the existing sections, emit two more fields:

**client_experience_frame** — ONE short sentence (max ~150 chars) describing what the client is currently feeling, waiting on, or annoyed by. This is the intra-day triage anchor. Examples:
- "Waiting on photographer profiles — chased twice, no response. Feeling unmanaged."
- "Just confirmed venue, excited and looking forward to first call this week."
- "Silent 30d since payment ask — engagement risk."
- "Fully aligned, no active expectation."
Never empty. If nothing is active, say "No active expectation" or describe the current calm.

**vendor_coverage** — array of vendor mentions extracted from chat. For each vendor discussed in the signal window: vendor_type (photographer, decorator, caterer, florist, venue, DJ, pandit, choreographer, makeup_artist, lighting, videographer, entertainment, other), vendor_name (name if mentioned, "" if unnamed), status (confirmed = locked in, pending = discussed but not confirmed, at_risk = issues/delays, unknown = just mentioned), last_mentioned (DD MMM), note (one-line context). Only include vendors actually discussed in signals. Empty array if no vendor conversation in window. If a vendor type is discussed but no name appears in chat, set vendor_name to "" AND add a corresponding entry to "ai_clarification" with category vendor and a question like "Which photographer was discussed on DD MMM — no name given in chat?". Never invent a vendor name or carry over a name from prior context.

**decision_intel** — { pending_decisions, recent_decisions }. pending_decisions: things that need a decision but haven't been made yet (deadline = DD MMM or "", blocking = true if other work is waiting on this). recent_decisions: decisions made in the signal window (decided_by = display label, decided_on = DD MMM). Only include clear decisions, not vague preferences. Both arrays can be empty.

**ai_clarification** — 0 to 3 items where you genuinely need TL context or are uncertain. Each: { question, reason, category }. Categories: sentiment | payment | team | vendor | other. Examples:
- { question: "Is Aditya off this week?", reason: "Zero internal-group activity in 6 days, unusual for him", category: "team" }
- { question: "Did the client approve the venue or just acknowledge?", reason: "Reply was a one-word 'ok' on a multi-point ask", category: "vendor" }
Confident bad calls are worse than admitted uncertainty. Empty array is fine when confidence is high.

## Sentiment scale
- positive: client is engaged, enthusiastic, actively moving things forward
- neutral: routine communication, no strong signals either way
- cautious: some hesitation, delays, or concerns but still engaged
- anxious: client is worried, repeatedly following up, or unhappy
- cold: client is unresponsive, has ghosted, or expressed desire to pause/cancel

## Confidence (for client_pulse)
- high: 20+ client messages in the chat window
- medium: 5–20 client messages
- low: fewer than 5 client messages

## Attribution format
Always: [Display Label, DD MMM] e.g. [Bhavika (Planner), 3 May] or [Aayushi (Client), 9 May]
For "days_silent": count from the most recent client message to today. 0 = messaged today.
For "last_active_date" in team_status: use "DD MMM" format or "" if never seen in this window.
For "due" in commitments: use "DD MMM" or "" if no date was given.

## Team status silence rule
If a team member's last_active_date is more than 7 days before TODAY, the "activity_note" MUST start with "Silent {N}d — " where {N} is whole days from last activity to TODAY. This prevents a reader from misreading "last active 1 May" as "currently engaged" when the project hasn't moved in two weeks. Example: "Silent 11d — last visible activity was sharing the venue brochure on 3 May."

## Clarification message tone (for open_questions)
Direct and accountable, like a TL checking in with their team. Not stiff or corporate. No em dashes anywhere. Use commas or full stops instead.

Rules:
- No em dashes (replace with comma or period)
- No emojis
- Use "please" when making a request
- Add accountability phrases where things are being left open: "please make sure we're on top of this", "let's not leave open points like this", "please ensure this doesn't get missed"
- No thank you or sign-off at the end
- Every point is a directive or a specific status ask, never a question looped back at Amaan
- Write as if the planner may not be around tomorrow, full context in every point

Format: "Hey Team, [opener].\nIf any of these were discussed on call, please ensure there's a text trail.\n1. ...\n2. ..."

Good openers (rotate, no em dashes):
"need an update on a few things"
"few things need to be addressed"
"need clarity on these before we move forward"
"need these sorted"

Good points:
"The cx asked about [X] on [date] and we haven't sent anything back yet. Please share the costing with them today."
"Photography confirmation has been pending since [date]. Please follow up with them directly and get a yes or no."
"Collection is at ₹[amount] of ₹[total]. Please get a date from the couple for the next instalment."
"Venue confirmation was due [date], what's the status? Please make sure this goes out soon."
"Guys, still waiting on a response on the decor timeline I asked about yesterday." (continuation when prior ask unanswered)
"Pandit profiles were requested on [date], what's the progress here?"

Bad (do not do):
- Em dashes anywhere
- "Should we follow up again or wait?" (self-consultation)
- Corporate stiffness ("please confirm receipt", "kindly revert")
- Vague asks not tied to specific dates or events
- % for collection, always use ₹ amount from TRACKER
- Restarting a conversation already in progress ("what's the update on decor?" when it was asked yesterday and is unanswered — say "still waiting on" instead)
- Sharp/escalatory tone in the draft message — if the situation needs sharper energy, surface "may need a direct call" in needs_you, never write the sharp version

## what_changed (MANDATORY — minimum 3 items when signals exist)
List 3-8 concrete events from the signal window. Each item: one sentence, ending with [Display Label, DD MMM] attribution. Focus on things that moved, broke, or appeared since the last brief. Examples:
- "Payment of ₹5L confirmed via NEFT [Bhavika, 18 May]"
- "Client chased photographer deliverables for second time [Aayushi, 18 May]"
- "Venue contract shared internally but not yet sent to client [Tapasya, 15 May]"

FORBIDDEN: "No notable changes", "Quiet week", "Nothing happened", or any placeholder string. If you can't find 3 events, you are not reading hard enough — vendor shares, deliverables sent, calls scheduled, asks made, silences that broke, profiles requested, overdue items still overdue — all count as events. Returning a 1-item array with a placeholder phrase is treated as failure. Empty array allowed ONLY when the signal count is literally zero.

## Mode
The user prompt will specify CATCH-UP (full project history) or DAILY (last 14 days).
- CATCH-UP: what_changed = key developments across the full timeline. Focus on project trajectory and open items.
- DAILY: what_changed = events in the last 24 hours only.`;

// --- Data loaders ---

interface ProjectRow {
  pid: number;
  cx_name: string | null;
  cx_name_studio: string | null;
  event_start_date: string | null;
  event_end_date: string | null;
  venue: string | null;
  region: string | null;
  team_lead: string | null;
  planner: string | null;
  designer: string | null;
  project_manager: string | null;
  rm: string | null;
  vendor_manager: string | null;
  package_price_eff: string | null;
  collection_pct: string | null;
  bgmv: string | null;
  project_health: number | null;
  cancellation_risk: number | null;
  t_days: number | null;
  d_days: number | null;
  sentiment: string | null;
  planning_status: string | null;
}

async function loadProject(pid: number): Promise<ProjectRow | null> {
  const { data, error } = await supabase
    .from('projects')
    .select(`pid, cx_name, cx_name_studio, event_start_date, event_end_date,
             venue, region, team_lead, planner, designer, project_manager, rm, vendor_manager,
             package_price_eff, collection_pct, bgmv, project_health, cancellation_risk,
             t_days, d_days, sentiment, planning_status`)
    .eq('pid', pid)
    .single<ProjectRow>();
  if (error) { console.error(`  project load error:`, error.message); return null; }
  return data;
}

async function loadLastSignalDate(pid: number): Promise<string | null> {
  const { data } = await supabase
    .from('signals')
    .select('sent_at')
    .eq('pid', pid)
    .not('body', 'is', null)
    .order('sent_at', { ascending: false })
    .limit(1);
  return data?.[0]?.sent_at ?? null;
}

function buildSilenceBrief(
  project: ProjectRow,
  lastSignalAt: string | null,
  briefDate: string,
  pidState: PidState | null,
): BriefJSON {
  const today = new Date(briefDate + 'T00:00:00+05:30');
  const lastDate = lastSignalAt ? new Date(lastSignalAt) : null;
  const daysSilent = lastDate
    ? Math.floor((today.getTime() - lastDate.getTime()) / (24 * 60 * 60 * 1000))
    : 999;
  const lastDateLabel = lastDate
    ? lastDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata' })
    : 'never recorded';

  const firstName = (full: string | null) => (full ?? '').trim().split(/\s+/)[0];
  const plannerFirst = firstName(project.planner) || 'team';

  const teamStatus: BriefJSON['team_status'] = [];
  if (project.planner) teamStatus.push({
    display_label: `${firstName(project.planner)} (Planner)`,
    role: 'planner',
    last_active_date: '',
    activity_note: `Silent ${daysSilent}d — no visible activity in the 14-day window.`,
  });
  if (project.designer) teamStatus.push({
    display_label: `${firstName(project.designer)} (Designer)`,
    role: 'designer',
    last_active_date: '',
    activity_note: `Silent ${daysSilent}d — no visible activity in the 14-day window.`,
  });
  if (project.project_manager) teamStatus.push({
    display_label: `${firstName(project.project_manager)} (PM)`,
    role: 'project_manager',
    last_active_date: '',
    activity_note: `Silent ${daysSilent}d — no visible activity in the 14-day window.`,
  });

  return {
    client_pulse: {
      sentiment: 'cold',
      confidence: 'high',
      summary: `No client or team activity in the 14-day window. Last signal in this project was ${lastDateLabel} (${daysSilent} days ago). Project status is Planning In-Progress with ${plannerFirst} assigned — silence on an active planning project is itself the signal.`,
      days_silent: daysSilent,
    },
    team_status: teamStatus,
    what_changed: [`No team or client activity in window. Last signal was ${lastDateLabel} (${daysSilent} days ago).`],
    commitments: [],
    needs_you: [{
      headline: `PID silent ${daysSilent}d — chase planner status`,
      detail: `Last activity ${lastDateLabel}. Project is Planning In-Progress with ${project.planner} as planner — chase status with planner today and confirm whether project is genuinely stalled or just off-channel.`,
      priority: 'urgent',
      risk_type: 'visibility',
    }],
    unacknowledged_requests: [],
    open_questions: {
      clarification_message: `Hey Team, this project has been silent ${daysSilent} days since ${lastDateLabel}. If any of these were discussed on call, please ensure there's a text trail.\n1. ${plannerFirst} — please confirm current status with the couple today and share what's blocking progress.\n2. Internal flag: ${daysSilent}d silence on an active Planning In-Progress PID is a process risk — we need movement visible in the group.`,
    },
    cross_source_flags: [],
    client_experience_frame: `Client silent ${daysSilent}d — no current expectation visible. Project quietness is itself the signal.`,
    ai_clarification: [
      {
        question: `Is ${plannerFirst} working off-channel with the client?`,
        reason: `${daysSilent}d of group silence on a Planning In-Progress PID is unusual — could be off-group movement we're not seeing.`,
        category: 'team' as const,
      },
    ],
    phase: pidState?.phase ?? 'active_planning',
    runway_pct: pidState?.runway_pct ?? null,
    recovery_state: pidState?.recovery_entered_at
      ? {
          entered_at: pidState.recovery_entered_at,
          sustained_positive: pidState.recovery_sustained_positive,
          last_positive_marker_at: pidState.recovery_last_positive_marker_at,
        }
      : null,
    amaan_self_loop: [],
    designer_lane: { ...EMPTY_DESIGNER_LANE, assigned_designer: project.designer },
    pm_lane: { ...EMPTY_PM_LANE, assigned_pm: project.project_manager },
    vm_lane: EMPTY_VM_LANE,
    commercial_trail: [],
    vendor_coverage: [],
    decision_intel: { pending_decisions: [], recent_decisions: [] },
    phase_expectations: computePhaseExpectations(pidState),
    exceptional_pid_score: EMPTY_EXCEPTIONAL_SCORE,
  };
}

interface FeedbackRow {
  user_input: string;
  created_at: string;
}

async function loadRecentFeedback(pid: number): Promise<FeedbackRow[]> {
  const { data } = await supabase
    .from('brief_feedback')
    .select('user_input, created_at')
    .eq('pid', pid)
    .order('created_at', { ascending: false })
    .limit(3);
  return (data ?? []) as FeedbackRow[];
}

// --- Continuity (W1): load prior clarification + team responses ---
interface PriorContinuity {
  hadPriorAsk: boolean;
  priorBriefDate: string | null;
  priorMessage: string | null;
  status: 'sent_answered' | 'sent_unanswered' | 'not_sent' | 'no_prior';
  teamResponseSnippets: string[];
}

async function loadPriorContinuity(pid: number, briefDate: string): Promise<PriorContinuity> {
  const empty: PriorContinuity = {
    hadPriorAsk: false,
    priorBriefDate: null,
    priorMessage: null,
    status: 'no_prior',
    teamResponseSnippets: [],
  };

  const sevenDaysAgo = new Date(briefDate);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0, 10);

  const { data: rows } = await supabase
    .from('clarification_evaluations')
    .select('brief_date, suggested_text, actual_sent, matched_at')
    .eq('pid', pid)
    .gte('brief_date', sevenDaysAgoStr)
    .lt('brief_date', briefDate)
    .order('brief_date', { ascending: false })
    .limit(1);

  if (!rows || rows.length === 0) return empty;

  const row = rows[0] as {
    brief_date: string;
    suggested_text: string | null;
    actual_sent: string | null;
    matched_at: string | null;
  };
  const priorMessage = row.actual_sent ?? row.suggested_text;
  if (!priorMessage) return { ...empty, priorBriefDate: row.brief_date };

  const responseStart = row.matched_at
    ?? new Date(row.brief_date + 'T08:00:00+05:30').toISOString();
  const responseEnd = new Date(briefDate + 'T00:00:00+05:30').toISOString();
  const tlWaId = process.env.TL_WA_ID ?? null;

  const { data: responses } = await supabase
    .from('signals')
    .select('body, sent_at, sender_name, sender_wa_id')
    .eq('pid', pid)
    .eq('chat_type', 'internal')
    .gte('sent_at', responseStart)
    .lte('sent_at', responseEnd)
    .order('sent_at', { ascending: true })
    .limit(100);

  const substantive = (responses ?? [])
    .filter((r) => !tlWaId || r.sender_wa_id !== tlWaId)
    .filter((r) => (r.body?.length ?? 0) > 30)
    .slice(0, 5)
    .map((r) => {
      const who = r.sender_name ?? r.sender_wa_id ?? 'unknown';
      const snippet = (r.body ?? '').slice(0, 150);
      return `${who}: ${snippet}`;
    });

  const status: PriorContinuity['status'] = row.actual_sent
    ? substantive.length > 0
      ? 'sent_answered'
      : 'sent_unanswered'
    : 'not_sent';

  return {
    hadPriorAsk: true,
    priorBriefDate: row.brief_date,
    priorMessage,
    status,
    teamResponseSnippets: substantive,
  };
}

interface SenderInfo { display_label: string; role: string }

// =====================================================================
// Step 7: Load prior AI-clarifications that Amaan has answered.
// =====================================================================

interface AnsweredClarification {
  question: string;
  answer: string;
  answered_at: string;
  category: string;
}

async function loadAnsweredClarifications(pid: number): Promise<AnsweredClarification[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('brief_clarifications')
    .select('question, amaan_answer, answered_at, category')
    .eq('pid', pid)
    .not('amaan_answer', 'is', null)
    .gte('answered_at', thirtyDaysAgo)
    .order('answered_at', { ascending: false })
    .limit(5);
  return (data ?? []).map((r) => ({
    question: r.question as string,
    answer: (r.amaan_answer as string) ?? '',
    answered_at: (r.answered_at as string) ?? '',
    category: (r.category as string) ?? 'other',
  }));
}

async function persistClarifications(
  pid: number,
  briefDate: string,
  isCatchup: boolean,
  clarifications: BriefJSON['ai_clarification'],
): Promise<void> {
  if (clarifications.length === 0) return;

  // Look up brief_id for the just-written brief row.
  const { data: briefRow } = await supabase
    .from('briefs')
    .select('id')
    .eq('pid', pid)
    .eq('brief_date', briefDate)
    .eq('is_catchup', isCatchup)
    .maybeSingle<{ id: string }>();

  const briefId = briefRow?.id ?? null;

  // Insert one at a time; ignore duplicate-key errors (unique index on md5(question)
  // prevents duplicates when the same brief is regenerated, but Supabase upsert
  // can't reference expression indexes via onConflict — so we catch 23505 manually).
  for (const c of clarifications) {
    const { error } = await supabase
      .from('brief_clarifications')
      .insert({
        pid,
        brief_id: briefId,
        brief_date: briefDate,
        question: c.question,
        ai_uncertainty_reason: c.reason,
        category: c.category,
      });

    if (error && error.code !== '23505' && !error.message.toLowerCase().includes('duplicate')) {
      // Soft-fail: don't break the pipeline over clarification persistence.
      console.error(`  clarification persistence error (PID ${pid}):`, error.message);
    }
  }
}

// =====================================================================
// pid_state loader + deterministic brief field computations (Steps 5/6/9/10)
// =====================================================================

interface PidState {
  phase: PidPhase;
  runway_pct: number | null;
  planning_started_at: string | null;
  recovery_entered_at: string | null;
  recovery_last_positive_marker_at: string | null;
  recovery_sustained_positive: boolean;
  heightened_monitoring_until: string | null;
}

async function loadPidState(pid: number): Promise<PidState | null> {
  const { data } = await supabase
    .from('pid_state')
    .select('phase, runway_pct, planning_started_at, recovery_entered_at, recovery_last_positive_marker_at, recovery_sustained_positive, heightened_monitoring_until')
    .eq('pid', pid)
    .maybeSingle<PidState>();
  return data;
}

function computeAmaanSelfLoop(signals: SignalRow[]): BriefJSON['amaan_self_loop'] {
  const tlWaId = process.env.TL_WA_ID;
  if (!tlWaId) return [];

  const QUESTION_HINT = /\?|\bplease\b|\b(?:status|update|guys|team)\b.*\?|^(?:can|are|is|will|should|when|where|how|what|why)\b/i;
  const items: BriefJSON['amaan_self_loop'] = [];

  for (const sig of signals) {
    if (sig.sender_wa_id !== tlWaId) continue;
    if (sig.chat_type !== 'internal') continue;
    if (!sig.body) continue;
    if (!QUESTION_HINT.test(sig.body)) continue;

    const askedAt = new Date(sig.sent_at);
    const ageHours = (Date.now() - askedAt.getTime()) / (1000 * 60 * 60);
    if (ageHours < 24 || ageHours > 168) continue;

    const responseEnd = askedAt.getTime() + 24 * 60 * 60 * 1000;
    const hasResponse = signals.some((r) => {
      if (!r.body || r.body.length < 30) return false;
      if (r.sender_wa_id === tlWaId) return false;
      if (r.chat_type !== 'internal') return false;
      const rTs = new Date(r.sent_at).getTime();
      return rTs > askedAt.getTime() && rTs < responseEnd;
    });
    if (hasResponse) continue;

    items.push({
      original_ask: sig.body.slice(0, 200),
      asked_at: sig.sent_at,
      hours_unanswered: Math.round(ageHours),
      suggested_reping: `Guys, still waiting on a response to: "${sig.body.slice(0, 80).trim()}"`,
    });
  }

  const seen = new Set<string>();
  return items.filter((i) => {
    const key = i.original_ask.slice(0, 50).toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 5);
}

const DESIGN_VOCAB = /\b(?:moodboard|decor|theme|design|monogram|save[\s-]the[\s-]date|invite|stationery|printable|brief|colou?r\s+palette)\b/i;

function senderRole(
  s: SignalRow,
  senders: { byName: Map<string, SenderInfo>; byWaId: Map<string, SenderInfo> },
): string | null {
  const info = s.sender_name
    ? senders.byName.get(s.sender_name)
    : s.sender_wa_id
    ? senders.byWaId.get(s.sender_wa_id)
    : undefined;
  return info?.role ?? null;
}

function computeDesignerLane(
  project: ProjectRow,
  signals: SignalRow[],
  senders: { byName: Map<string, SenderInfo>; byWaId: Map<string, SenderInfo> },
): BriefJSON['designer_lane'] {
  const designer = project.designer;
  const firstClient = signals.find((s) => s.chat_type === 'client');
  const daysSinceIntro = firstClient
    ? Math.floor((Date.now() - new Date(firstClient.sent_at).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const designSurfaceCount = signals.filter((s) => {
    if (s.chat_type !== 'client') return false;
    if (senderRole(s, senders) !== 'designer') return false;
    return s.body !== null && DESIGN_VOCAB.test(s.body);
  }).length;

  let flag: string | null = null;
  if (!designer) flag = 'No designer assigned';
  else if (daysSinceIntro !== null && daysSinceIntro >= 28 && designSurfaceCount === 0) {
    flag = `${designer} silent on design surface ${daysSinceIntro}d after intro`;
  }

  return {
    assigned_designer: designer,
    days_since_intro_call: daysSinceIntro,
    design_surface_count: designSurfaceCount,
    flag,
  };
}

function computePmLane(
  project: ProjectRow,
  signals: SignalRow[],
  senders: { byName: Map<string, SenderInfo>; byWaId: Map<string, SenderInfo> },
  phase: PidPhase,
): BriefJSON['pm_lane'] {
  const pm = project.project_manager;
  const isLatePhase = phase === 'mid_runway' || phase === 'final_quarter';
  const phaseRole: 'early' | 'late' | 'na' = pm ? (isLatePhase ? 'late' : 'early') : 'na';

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const pmClientMessages = signals.filter((s) => {
    if (s.chat_type !== 'client') return false;
    if (new Date(s.sent_at).getTime() < thirtyDaysAgo) return false;
    return senderRole(s, senders) === 'project_manager';
  }).length;

  let flag: string | null = null;
  if (pm && phaseRole === 'late' && pmClientMessages === 0) {
    flag = `${pm} silent in client group during ${phase} — late-phase coordination needs visibility`;
  } else if (pm && phaseRole === 'early' && pmClientMessages === 0) {
    flag = `${pm} zero client-group messages in 30d (early phase — light surface still expected)`;
  }

  return {
    assigned_pm: pm,
    phase_role: phaseRole,
    client_group_messages_30d: pmClientMessages,
    meet_voice_count_30d: 0, // v1: no transcript layer
    flag,
  };
}

const VM_TAG_RE = /\b(?:monu|@VM\b|vendor\s+management|VM\s+team|VM\s+please|VM,)\b/i;

function computeVmLane(signals: SignalRow[]): BriefJSON['vm_lane'] {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const tagMessages = signals.filter((s) => {
    if (s.chat_type !== 'internal') return false;
    if (new Date(s.sent_at).getTime() < thirtyDaysAgo) return false;
    return s.body !== null && VM_TAG_RE.test(s.body);
  });

  const openRequests = tagMessages.slice(-5).map((s) => ({
    tagged_at: s.sent_at,
    topic: (s.body ?? '').slice(0, 100),
    has_deadline: false,
    status_updates: 0,
  }));

  const flag = openRequests.length >= 3
    ? `VM tagged ${openRequests.length} times in 30d — verify response cadence`
    : null;

  return { open_requests: openRequests, flag };
}

function computePhaseExpectations(pidState: PidState | null): BriefJSON['phase_expectations'] {
  if (!pidState || pidState.runway_pct === null) return { expected_at_runway_pct: [] };
  // From handoff § 12 (Planning Runway Logic)
  const ALL: Array<{ item: string; threshold: number }> = [
    { item: 'Photography locked', threshold: 25 },
    { item: 'Makeup locked', threshold: 25 },
    { item: 'Collection beyond booking fee', threshold: 25 },
    { item: 'DJ locked', threshold: 50 },
    { item: 'MC/Anchor locked', threshold: 50 },
    { item: 'Decor underway', threshold: 50 },
    { item: 'Smaller services closing (mehendi/baraat)', threshold: 67 },
    { item: 'All vendors locked', threshold: 75 },
    { item: 'License clarity (T-45 to T-60)', threshold: 75 },
    { item: '50% collection on locked vendors', threshold: 75 },
    { item: '100% collection plan (T-21)', threshold: 90 },
  ];
  const rp = pidState.runway_pct;
  return {
    expected_at_runway_pct: ALL
      .filter((e) => rp >= e.threshold)
      .map((e) => ({ item: e.item, expected: true, actual: false })),
  };
}

const COLLAB_RE = /\b(?:we[’']?ll|together|let[’']?s|us\s+all|our\s+(?:next|approach|plan)|figure\s+(?:this|it)\s+out|work\s+this\s+out|happy\s+to)\b/i;

function computeExceptionalPidScore(
  signals: SignalRow[],
  senders: { byName: Map<string, SenderInfo>; byWaId: Map<string, SenderInfo> },
): BriefJSON['exceptional_pid_score'] {
  const plannerClientMsgs = signals.filter((s) => s.chat_type === 'client' && senderRole(s, senders) === 'planner');
  const clientMsgs = signals.filter((s) => s.chat_type === 'client' && senderRole(s, senders) === 'client');
  const teamMsgs = signals.filter((s) => {
    const r = senderRole(s, senders);
    return r === 'planner' || r === 'designer' || r === 'project_manager' || r === 'team_lead';
  });

  const proactiveCount = plannerClientMsgs.filter((s) => (s.body?.length ?? 0) > 50).length;
  const proactiveScore = plannerClientMsgs.length > 0 ? Math.min(1, proactiveCount / plannerClientMsgs.length) : 0;

  const avgLen = (msgs: SignalRow[]) =>
    msgs.length > 0 ? msgs.reduce((sum, m) => sum + (m.body?.length ?? 0), 0) / msgs.length : 0;
  const avgClient = avgLen(clientMsgs);
  const avgPlanner = avgLen(plannerClientMsgs);
  const mirroringScore = avgClient > 0 && avgPlanner > 0
    ? Math.max(0, 1 - Math.abs(avgClient - avgPlanner) / Math.max(avgClient, avgPlanner))
    : 0;

  const collabCount = teamMsgs.filter((s) => s.body !== null && COLLAB_RE.test(s.body)).length;
  const denominator = Math.max(10, teamMsgs.length * 0.2);
  const collaborativeScore = teamMsgs.length > 0 ? Math.min(1, collabCount / denominator) : 0;

  const total = proactiveScore + mirroringScore + collaborativeScore;
  return {
    proactive_surface: Math.round(proactiveScore * 100) / 100,
    client_mirroring: Math.round(mirroringScore * 100) / 100,
    collaborative_framing: Math.round(collaborativeScore * 100) / 100,
    badge: total > 2.0,
  };
}

const EMPTY_DESIGNER_LANE: BriefJSON['designer_lane'] = {
  assigned_designer: null,
  days_since_intro_call: null,
  design_surface_count: 0,
  flag: null,
};
const EMPTY_PM_LANE: BriefJSON['pm_lane'] = {
  assigned_pm: null,
  phase_role: 'na',
  client_group_messages_30d: 0,
  meet_voice_count_30d: 0,
  flag: null,
};
const EMPTY_VM_LANE: BriefJSON['vm_lane'] = {
  open_requests: [],
  flag: null,
};
const EMPTY_EXCEPTIONAL_SCORE: BriefJSON['exceptional_pid_score'] = {
  proactive_surface: 0,
  client_mirroring: 0,
  collaborative_framing: 0,
  badge: false,
};

async function loadSenders(pid: number): Promise<{
  byName: Map<string, SenderInfo>;
  byWaId: Map<string, SenderInfo>;
}> {
  const { data } = await supabase
    .from('signal_senders')
    .select('sender_name, sender_wa_id, display_label, role')
    .eq('pid', pid);
  const byName = new Map<string, SenderInfo>();
  const byWaId = new Map<string, SenderInfo>();
  for (const row of data ?? []) {
    const info = {
      display_label: row.display_label || row.sender_name || row.sender_wa_id || 'unknown',
      role: row.role,
    };
    if (row.sender_name) byName.set(row.sender_name, info);
    if (row.sender_wa_id) byWaId.set(row.sender_wa_id, info);
  }
  return { byName, byWaId };
}

interface SignalRow {
  sender_name: string | null;
  sender_wa_id: string | null;
  body: string | null;
  sent_at: string;
  chat_type: string | null;
}

async function loadSignals(pid: number, catchup: boolean, briefDate: string): Promise<SignalRow[]> {
  const cutoff = catchup
    ? briefDateCutoff(briefDate, 365)
    : briefDateCutoff(briefDate, 14);

  const { data } = await supabase
    .from('signals')
    .select('sender_name, sender_wa_id, body, sent_at, chat_type')
    .eq('pid', pid)
    .not('body', 'is', null)
    .gte('sent_at', cutoff)
    .order('sent_at', { ascending: false })
    .limit(1200);

  // Reverse so prompt sees chronological order but we've captured the 1200 most recent
  return ((data ?? []) as SignalRow[]).reverse();
}

// --- Prompt builder ---

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata' });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
}

function buildUserPrompt(
  project: ProjectRow,
  senders: { byName: Map<string, SenderInfo>; byWaId: Map<string, SenderInfo> },
  signals: SignalRow[],
  feedback: FeedbackRow[],
  continuity: PriorContinuity,
  pidState: PidState | null,
  answeredClarifications: AnsweredClarification[],
  sopFlags: SopFlagRow[],
  catchup: boolean,
  briefDate: string,
): string {
  const rupees = (v: string | null) =>
    v ? `₹${(parseFloat(v) / 100000).toFixed(1)}L` : '—';

  const collectedAmount = (() => {
    const pkg = parseFloat(project.package_price_eff ?? '');
    const pct = parseFloat(project.collection_pct ?? '');
    if (!Number.isFinite(pkg) || !Number.isFinite(pct)) return null;
    return pkg * pct / 100;
  })();
  const collectionLine = collectedAmount != null
    ? `${rupees(String(collectedAmount))} of ${rupees(project.package_price_eff)} collected (${project.collection_pct}%)`
    : `${project.collection_pct ?? '?'}%`;

  const daysLabel = project.t_days == null
    ? ''
    : project.t_days >= 0
    ? `(in ${project.t_days} days)`
    : `(${Math.abs(project.t_days)} days ago — PAST EVENT)`;

  const roster = [
    project.team_lead && `TL: ${project.team_lead}`,
    project.planner && `Planner: ${project.planner}`,
    project.designer && `Designer: ${project.designer}`,
    project.project_manager && `PM: ${project.project_manager}`,
    project.rm && `RM: ${project.rm}`,
    project.vendor_manager && `VM: ${project.vendor_manager}`,
  ].filter(Boolean).join(' · ');

  // Format signals; if over MAX_CHARS, drop oldest first to keep most recent
  const MAX_CHARS = 90_000;
  const ROLE_LABEL: Record<string, string> = {
    team_lead: 'TL',
    planner: 'Planner',
    designer: 'Designer',
    project_manager: 'PM',
    vendor_manager: 'VM',
    rm: 'RM',
    client: 'Client',
    vendor: 'Vendor',
    meragi_other: 'Meragi',
    unknown: '?',
  };
  const briefMidnightMs = new Date(briefDate + 'T00:00:00+05:30').getTime();
  const allSignalLines = signals.map((sig) => {
    const senderInfo = sig.sender_name
      ? senders.byName.get(sig.sender_name)
      : sig.sender_wa_id
      ? senders.byWaId.get(sig.sender_wa_id)
      : undefined;
    const label = senderInfo?.display_label ?? sig.sender_name ?? sig.sender_wa_id ?? 'Unknown';
    const roleLabel = senderInfo?.role ? (ROLE_LABEL[senderInfo.role] ?? senderInfo.role) : '?';
    const groupTag = sig.chat_type === 'client' ? '[CLIENT-GROUP]' : '[INTERNAL]';
    const daysAgo = Math.max(0, Math.floor((briefMidnightMs - new Date(sig.sent_at).getTime()) / (24 * 60 * 60 * 1000)));
    return `[${formatDate(sig.sent_at)} ${formatTime(sig.sent_at)} — ${daysAgo}d ago] ${groupTag} ${label} (${roleLabel}): ${sig.body}`;
  });

  // Iterate from newest (end of array) backwards, prepend; stop when budget exhausted
  const lines: string[] = [];
  let charCount = 0;
  for (let i = allSignalLines.length - 1; i >= 0; i--) {
    if (charCount + allSignalLines[i].length > MAX_CHARS) break;
    lines.unshift(allSignalLines[i]);
    charCount += allSignalLines[i].length;
  }

  const mode = catchup
    ? 'CATCH-UP — full project history (last 12 months)'
    : 'DAILY — last 14 days';

  return `TODAY: ${briefDate} (Asia/Kolkata)

=== PROJECT CONTEXT ===
PID: ${project.pid}
TRACKER: Couple: ${project.cx_name ?? '?'}
TRACKER: Event: ${project.event_start_date ?? '?'}${project.event_end_date && project.event_end_date !== project.event_start_date ? ' → ' + project.event_end_date : ''} ${daysLabel}
TRACKER: Venue: ${project.venue ?? '?'}
TRACKER: Region: ${project.region ?? '?'}
TRACKER: Package SP: ${rupees(project.package_price_eff)} · GMV: ${rupees(project.bgmv)}
TRACKER: Collection: ${collectionLine}
TRACKER: Health: ${project.project_health ?? '?'}/5 · Cancel Risk: ${project.cancellation_risk ?? '?'}/5
TRACKER: Roster: ${roster}
TRACKER: Sentiment (tracker): ${project.sentiment ?? '—'}
STATE: phase=${pidState?.phase ?? 'unknown'} · runway=${pidState?.runway_pct != null ? pidState.runway_pct + '%' : '?%'} · recovery=${pidState?.recovery_entered_at ? 'YES (entered ' + pidState.recovery_entered_at.slice(0, 10) + ' · ' + (pidState.recovery_sustained_positive ? 'sustained-positive' : 'heightened-monitoring') + ')' : 'no'}

Reason about expectations through this lens — a first-quarter PID without DJ locked is normal; a final-quarter PID without DJ locked is critical.

=== KNOWN SENDERS (from resolved roster) ===
${[...new Set([...senders.byName.values(), ...senders.byWaId.values()].map((s) => `${s.display_label} (${s.role})`))].join(', ') || 'none resolved'}

=== DETERMINISTIC FLAGS (lexical pre-pass, last 14 days) ===
${sopFlags.length === 0
  ? 'No deterministic flags fired in this window.'
  : sopFlags.map((f) => `[${f.severity.toUpperCase()}] ${f.flag} — ${f.detail}`).join('\n')}

=== PRIOR USER FEEDBACK ON BRIEFS FOR THIS PID ===
${feedback.length === 0
  ? 'No feedback recorded yet.'
  : feedback
      .map((f) => `[${f.created_at.slice(0, 10)}] ${f.user_input.trim()}`)
      .join('\n')}
Treat the feedback above as authoritative corrections. If the user said "don't do X", never do X in this brief.

=== PRIOR AMAAN-ANSWERED CLARIFICATIONS (authoritative context) ===
${answeredClarifications.length === 0
  ? 'No prior clarifications answered for this PID.'
  : answeredClarifications.map((c) => `[${(c.answered_at || '').slice(0, 10)}] ${c.category.toUpperCase()} — Q: ${c.question}\n  A: ${c.answer}`).join('\n\n')
}
Use these answers as authoritative context. Do not re-ask what Amaan has already answered. Reflect the answers in your reasoning (e.g. if Amaan said "Aditya is off this week," don't flag Aditya's silence as a process issue).

=== YESTERDAY'S OPEN THREAD (continuity) ===
${continuity.hadPriorAsk
  ? `Prior clarification message (brief_date: ${continuity.priorBriefDate}):
"${continuity.priorMessage}"

Status: ${
  continuity.status === 'sent_answered'
    ? `SENT and the team responded. Recent substantive responses:\n${continuity.teamResponseSnippets.map((s) => '- ' + s).join('\n')}\nIf today's brief touches the same topics, acknowledge the response and move forward — do not re-ask what has already been answered.`
    : continuity.status === 'sent_unanswered'
    ? `SENT but NO substantive team response yet (only acks/emojis or silence). If you raise these topics today, frame as continuation — "Guys, still waiting on a response on X" or "any movement on the Y I asked about yesterday?" Never restart with "what's the update on X?"`
    : continuity.status === 'not_sent'
    ? `DRAFTED in yesterday's brief but never actually sent to the team. If the issues remain unresolved, raising them again is fine — but be conscious the team has not seen them yet, so treat as a first ask, not a follow-up.`
    : 'Unknown prior status.'
}`
  : 'No prior clarification message in the last 7 days. Today is a fresh start — no continuation needed.'}

=== CHAT SIGNALS ===
Mode: ${mode}
Messages in window: ${signals.length} (showing ${lines.length} after truncation)

${lines.join('\n')}

=== TASK ===
Generate the JSON brief for PID ${project.pid} (${project.cx_name ?? '?'}).`;
}

// --- SOP / lexical flags ---

interface SopFlagRow {
  pid: number;
  flag: string;
  severity: string;
  detail: string;
}

async function loadSopFlags(pid: number): Promise<SopFlagRow[]> {
  const { data } = await supabase
    .from('sop_flags')
    .select('pid, flag, severity, detail')
    .eq('pid', pid);
  return (data ?? []) as SopFlagRow[];
}

// --- T1 call (DeepSeek V4 Pro) ---

// --- Zod schema for T1 output validation ---

const briefZod = z.object({
  client_pulse: z.object({
    sentiment: z.enum(['positive', 'neutral', 'cautious', 'anxious', 'cold']),
    confidence: z.enum(['high', 'medium', 'low']),
    summary: z.string(),
    days_silent: z.number(),
  }),
  team_status: z.array(z.object({
    display_label: z.string(),
    role: z.string(),
    last_active_date: z.string(),
    activity_note: z.string(),
  })),
  what_changed: z.array(z.string()),
  commitments: z.array(z.object({
    what: z.string(),
    owner: z.string(),
    due: z.string(),
    status: z.enum(['open', 'done', 'overdue', 'unclear']),
  })),
  needs_you: z.array(z.object({
    headline: z.string(),
    detail: z.string(),
    priority: z.enum(['urgent', 'soon', 'when_able']),
    risk_type: z.enum(['sentiment', 'collection', 'visibility', 'process', 'execution', 'cancellation']).optional(),
  })),
  unacknowledged_requests: z.array(z.object({
    request: z.string(),
    verbatim: z.string().optional(),
    asked_by: z.string(),
    asked_on: z.string(),
    days_unanswered: z.number(),
  })),
  open_questions: z.object({
    clarification_message: z.string(),
  }),
  cross_source_flags: z.array(z.object({
    flag: z.string(),
    chat_says: z.string(),
    tracker_says: z.string(),
  })),
  client_experience_frame: z.string(),
  ai_clarification: z.array(z.object({
    question: z.string(),
    reason: z.string(),
    category: z.enum(['sentiment', 'payment', 'team', 'vendor', 'other']),
  })),
  vendor_coverage: z.array(z.object({
    vendor_type: z.string(),
    vendor_name: z.string(),
    status: z.enum(['confirmed', 'pending', 'at_risk', 'unknown']),
    last_mentioned: z.string(),
    note: z.string(),
  })),
  decision_intel: z.object({
    pending_decisions: z.array(z.object({
      decision: z.string(),
      owner: z.string(),
      deadline: z.string(),
      blocking: z.boolean(),
    })),
    recent_decisions: z.array(z.object({
      decision: z.string(),
      decided_by: z.string(),
      decided_on: z.string(),
    })),
  }),
});

// --- Retry wrapper for transient errors (429, 503) ---

async function withRetry<T>(fn: () => Promise<T>, retries = 3, baseDelayMs = 3000): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const msg = (err as Error).message ?? '';
      const isRetryable = msg.includes('429') || msg.includes('503') || msg.includes('rate') || msg.includes('high demand');
      if (!isRetryable || attempt === retries) throw err;
      const delay = baseDelayMs * Math.pow(2, attempt);
      process.stdout.write(` [retry ${attempt + 1} in ${(delay / 1000).toFixed(0)}s]`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error('unreachable');
}

async function callT1(userPrompt: string): Promise<{ brief: HaikuBriefOutput; usage: { input_tokens: number; output_tokens: number } } | null> {
  const augmentedSystem = SYSTEM_PROMPT +
    '\n\nYou MUST respond with valid JSON matching this exact schema:\n' +
    JSON.stringify(BRIEF_SCHEMA, null, 2);
  const fullUserPrompt = userPrompt + '\n\nRESPOND WITH ONLY THE JSON OBJECT. No markdown, no preamble, no explanation.';

  try {
    type DSResponse = { choices: Array<{ message: { content: string | null } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };
    const response = await withRetry(() => deepseek.chat.completions.create({
      model: 'deepseek-v4-pro',
      max_tokens: 16384,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: augmentedSystem },
        { role: 'user', content: fullUserPrompt },
      ],
    } as Parameters<typeof deepseek.chat.completions.create>[0])) as unknown as DSResponse;

    const rawText = response.choices[0]?.message?.content ?? '';

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error(`  T1 parse error: no JSON object found`);
        return null;
      }
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (e2) {
        console.error(`  T1 parse error:`, (e2 as Error).message);
        return null;
      }
    }

    const validation = briefZod.safeParse(parsed);
    if (!validation.success) {
      const issues = validation.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`);
      console.error(`  T1 Zod validation failed:`, issues.join('; '));
      return null;
    }

    const usage = response.usage;
    const u = usage as unknown as Record<string, number>;
    if (u.prompt_cache_hit_tokens || u.prompt_cache_miss_tokens) {
      process.stdout.write(` cache[w:${u.prompt_cache_miss_tokens ?? 0}/r:${u.prompt_cache_hit_tokens ?? 0}]`);
    }

    return {
      brief: validation.data as HaikuBriefOutput,
      usage: {
        input_tokens: usage?.prompt_tokens ?? 0,
        output_tokens: usage?.completion_tokens ?? 0,
      },
    };
  } catch (err) {
    console.error(`  T1 error:`, err instanceof Error ? err.message : err);
    return null;
  }
}

// --- DB write ---

async function writeToDB(
  pid: number,
  briefDate: string,
  brief: BriefJSON,
  usage: { input_tokens: number; output_tokens: number },
  catchup: boolean,
): Promise<void> {
  const { error } = await supabase.from('briefs').upsert(
    {
      pid,
      brief_date: briefDate,
      model: 'deepseek-v4-pro',
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      is_catchup: catchup,
      brief_json: brief,
    },
    { onConflict: 'pid,brief_date,is_catchup' },
  );
  if (error) throw new Error(`DB write error: ${error.message}`);
}

// --- Markdown render ---

// Known team roster — matches people/<Name>.md note names exactly in the vault.
// Wikilinking these in brief markdown is what creates the people <-> PID graph cluster.
const VAULT_TEAM_ROSTER = [
  'Amaan Abdul Kader', 'Bhavika Gurnani', 'Shreyanshu Tiwari', 'Varun Mittal',
  'Tapasya Waldia', 'Somila Bhadauriya', 'Nikhil Gupta',
  'Aditya Sharma', 'Jaishree Patel', 'Narendra Singh',
  'Ananth Santhosh',
];

function wikilinkTeam(name: string | null): string {
  if (!name) return '';
  const trimmed = name.trim();
  if (VAULT_TEAM_ROSTER.includes(trimmed)) return `[[${trimmed}]]`;
  // Fuzzy: also wikilink if a full-name match exists after collapsing whitespace
  const normalized = trimmed.replace(/\s+/g, ' ');
  if (VAULT_TEAM_ROSTER.includes(normalized)) return `[[${normalized}]]`;
  return trimmed;
}

function linkifyTeamInText(text: string): string {
  let result = text;
  for (const full of VAULT_TEAM_ROSTER) {
    const escaped = full.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?<!\\[\\[)\\b${escaped}\\b(?!\\]\\])`, 'g');
    result = result.replace(re, `[[${full}]]`);
  }
  // Also wikilink first-name + role mentions: "Tapasya (Planner)" -> "[[Tapasya Waldia]] (Planner)"
  for (const full of VAULT_TEAM_ROSTER) {
    const first = full.split(' ')[0];
    const re = new RegExp(
      `(?<!\\[\\[)\\b${first}\\b(?=\\s*\\((?:planner|designer|project_manager|pm|tl|team_lead|rm)\\))`,
      'gi',
    );
    result = result.replace(re, `[[${full}]]`);
  }
  return result;
}

function renderMarkdown(
  project: ProjectRow,
  brief: BriefJSON,
  briefDate: string,
  catchup: boolean,
): string {
  const rupees = (v: string | null) =>
    v ? `₹${(parseFloat(v) / 100000).toFixed(1)}L` : '—';

  const daysLabel = project.t_days == null
    ? ''
    : project.t_days >= 0
    ? `in ${project.t_days} days`
    : `${Math.abs(project.t_days)} days ago`;

  const pulse = brief.client_pulse;
  const sentimentLabel: Record<string, string> = {
    positive: '[POSITIVE]', neutral: '[NEUTRAL]', cautious: '[CAUTIOUS]', anxious: '[ANXIOUS]', cold: '[COLD]',
  };

  const lines: string[] = [
    `---`,
    `pid: ${project.pid}`,
    `cx_name: ${project.cx_name ?? ''}`,
    `brief_date: ${briefDate}`,
    `is_catchup: ${catchup}`,
    `sentiment: ${pulse.sentiment}`,
    `health: ${project.project_health ?? ''}`,
    `---`,
    ``,
    `# ${project.cx_name ?? `PID ${project.pid}`} — ${briefDate}${catchup ? ' (catch-up)' : ''}`,
    ``,
    `**Phase:** ${brief.phase.replace(/_/g, ' ').toUpperCase()}${brief.runway_pct != null ? ` · Runway ${brief.runway_pct}%` : ''}${brief.exceptional_pid_score.badge ? ' · ⭐ EXCEPTIONAL' : ''}${brief.recovery_state ? ` · POST-RECOVERY (${brief.recovery_state.sustained_positive ? 'sustained' : 'heightened-monitoring'})` : ''}`,
    `**Event:** ${project.event_start_date ?? '?'}${project.event_end_date && project.event_end_date !== project.event_start_date ? ' → ' + project.event_end_date : ''} · ${project.venue ?? '?'} · ${daysLabel}`,
    `**Package:** ${rupees(project.package_price_eff)} · Collection ${project.collection_pct ?? '?'}% · Health ${project.project_health ?? '?'}/5 · Cancel risk ${project.cancellation_risk ?? '?'}/5`,
    `**Team:** ${[project.team_lead, project.planner, project.designer, project.project_manager].filter(Boolean).map(wikilinkTeam).join(' · ')}`,
    ``,
    `---`,
    ``,
    `## Client Experience`,
    `> ${brief.client_experience_frame || 'No active expectation.'}`,
    ``,
    `---`,
    ``,
    `## Client Pulse — ${sentimentLabel[pulse.sentiment] ?? '[UNKNOWN]'}`,
    `**${pulse.sentiment.toUpperCase()}** · Confidence: ${pulse.confidence} · Silent ${pulse.days_silent}d`,
    ``,
    pulse.summary,
    ``,
    `---`,
    ``,
    `## Team Status`,
    ...(brief.team_status.length
      ? brief.team_status.map((t) =>
          `- **${t.display_label}** (${t.role})${t.last_active_date ? ` · last active ${t.last_active_date}` : ''}${t.activity_note ? ` — ${t.activity_note}` : ''}`,
        )
      : ['- No team activity in window']),
    ``,
    `---`,
    ``,
    `## What Changed`,
    ...(brief.what_changed.length
      ? brief.what_changed.map((c) => `- ${c}`)
      : ['- No notable changes']),
    ``,
    `---`,
    ``,
    `## Commitments`,
    ...(brief.commitments.length
      ? brief.commitments.map(
          (c) =>
            `- [${c.status.toUpperCase()}] ${c.what} · **${c.owner}**${c.due ? ` · by ${c.due}` : ''}`,
        )
      : ['- None tracked']),
    ``,
    `---`,
    ``,
    `## Unacknowledged Client Requests`,
    ...((brief.unacknowledged_requests?.length ?? 0) > 0
      ? brief.unacknowledged_requests.map(
          (r) =>
            `- [UNANSWERED ${r.days_unanswered}d] "${r.request}"${r.verbatim ? ` — verbatim: "${r.verbatim}"` : ''} — ${r.asked_by}, ${r.asked_on}`,
        )
      : ['- None — every client request has been acknowledged']),
    ``,
    `---`,
    ``,
    `## Needs You`,
    ...(brief.needs_you.length
      ? brief.needs_you.map((n) => `- [${n.priority}${n.risk_type ? '/' + n.risk_type : ''}] **${n.headline}** — ${n.detail}`)
      : ['- Nothing urgent']),
    ``,
    `---`,
    ``,
    `## Clarification Message`,
    ...(brief.open_questions.clarification_message
      ? [`> ${brief.open_questions.clarification_message}`]
      : ['- Nothing to clarify']),
    `---`,
    ``,
    `## Cross-Source Flags`,
    ...(brief.cross_source_flags.length
      ? brief.cross_source_flags.map(
          (f) => `- [FLAG] **${f.flag}** — chat: "${f.chat_says}" · tracker: "${f.tracker_says}"`,
        )
      : ['- None']),
    ``,
    `---`,
    ``,
    `## Vendor Coverage`,
    ...(brief.vendor_coverage.length
      ? brief.vendor_coverage.map(
          (v) => `- **${v.vendor_type}**${v.vendor_name ? ` (${v.vendor_name})` : ''} — ${v.status}${v.last_mentioned ? ` · last mentioned ${v.last_mentioned}` : ''}${v.note ? ` · ${v.note}` : ''}`,
        )
      : ['- No vendor discussion in signal window']),
    ``,
    `---`,
    ``,
    `## Decision Intel`,
    ...(brief.decision_intel.pending_decisions.length
      ? [`**Pending:**`, ...brief.decision_intel.pending_decisions.map(
          (d) => `- ${d.blocking ? '🔴 ' : ''}**${d.decision}** — owner: ${d.owner}${d.deadline ? ` · deadline: ${d.deadline}` : ''}`,
        )]
      : ['- No pending decisions']),
    ...(brief.decision_intel.recent_decisions.length
      ? [``, `**Recent:**`, ...brief.decision_intel.recent_decisions.map(
          (d) => `- **${d.decision}** — ${d.decided_by}, ${d.decided_on}`,
        )]
      : []),
    ``,
    `---`,
    ``,
    `## Amaan's Open Asks (24h+ unanswered)`,
    ...(brief.amaan_self_loop.length
      ? brief.amaan_self_loop.flatMap((s) => [
          `- "${s.original_ask}" — asked ${s.hours_unanswered}h ago`,
          `  - Soft re-ping: > ${s.suggested_reping}`,
        ])
      : ['- None — all your asks have responses']),
    ``,
    `---`,
    ``,
    `## Role Lanes`,
    ``,
    `**Designer:** ${brief.designer_lane.assigned_designer ? wikilinkTeam(brief.designer_lane.assigned_designer) : '(unassigned)'}${brief.designer_lane.days_since_intro_call != null ? ` · ${brief.designer_lane.days_since_intro_call}d since intro` : ''} · ${brief.designer_lane.design_surface_count} design messages${brief.designer_lane.flag ? ` · ⚠ ${brief.designer_lane.flag}` : ''}`,
    ``,
    `**PM:** ${brief.pm_lane.assigned_pm ? wikilinkTeam(brief.pm_lane.assigned_pm) : '(unassigned)'} · ${brief.pm_lane.phase_role}-phase · ${brief.pm_lane.client_group_messages_30d} client-group msgs (30d)${brief.pm_lane.flag ? ` · ⚠ ${brief.pm_lane.flag}` : ''}`,
    ``,
    `**VM (Monu):** ${brief.vm_lane.open_requests.length} request(s) tagged in 30d${brief.vm_lane.flag ? ` · ⚠ ${brief.vm_lane.flag}` : ''}`,
    ``,
    `---`,
    ``,
    `## AI Clarification (things I'm not sure about)`,
    ...(brief.ai_clarification.length
      ? brief.ai_clarification.flatMap((c) => [
          `- **${c.category.toUpperCase()}** — ${c.question}`,
          `  - Reason: ${c.reason}`,
        ])
      : ['- High confidence on this brief — no clarification needed.']),
    ``,
    `---`,
    ``,
    `## Phase Expectations (at ${brief.runway_pct ?? '?'}% runway)`,
    ...(brief.phase_expectations.expected_at_runway_pct.length
      ? brief.phase_expectations.expected_at_runway_pct.map(
          (e) => `- ${e.item} — expected (verification via master sheet pending)`,
        )
      : ['- Too early in runway for big-ticket expectations.']),
    ``,
    `---`,
    ``,
    `## Related`,
    ``,
    `- PID hub: [[pids/${project.pid}]]`,
    `- [[00 - Map of Content]]`,
    `- [[people/00-index]]`,
  ];

  // Linkify any team names that appear in body content (Team Status entries, What Changed, etc.)
  return linkifyTeamInText(lines.join('\n'));
}

function writeMarkdownFiles(
  project: ProjectRow,
  brief: BriefJSON,
  briefDate: string,
  catchup: boolean,
): void {
  const md = renderMarkdown(project, brief, briefDate, catchup);
  const pid = project.pid;

  // pids/<pid>/briefs/<date>-catchup.md or <date>-daily.md
  const briefDir = `${VAULT_PATH}\\pids\\${pid}\\briefs`;
  mkdirSync(briefDir, { recursive: true });
  const suffix = catchup ? 'catchup' : 'daily';
  writeFileSync(`${briefDir}\\${briefDate}-${suffix}.md`, md, 'utf-8');

  // pids/<pid>.md — current state, overwritten each run
  const pidsDir = `${VAULT_PATH}\\pids`;
  mkdirSync(pidsDir, { recursive: true });
  writeFileSync(`${pidsDir}\\${pid}.md`, md, 'utf-8');
}

// --- Main ---

async function main() {
  const start = Date.now();
  const briefDate = dateArg ?? todayIstYmd();
  const mode = isCatchup ? 'CATCH-UP' : 'DAILY';

  console.log(`\nGenerating ${mode} briefs for ${targetPids.length} PID(s) — ${briefDate}`);
  console.log(`Model: deepseek-v4-pro  T=0  max_tokens=16384\n`);

  let ok = 0, failed = 0;
  let totalInput = 0, totalOutput = 0;

  for (const pid of targetPids) {
    process.stdout.write(`PID ${pid}... `);

    const [project, senders, signals, feedback, continuity, pidState, answeredClarifications, sopFlags] = await Promise.all([
      loadProject(pid),
      loadSenders(pid),
      loadSignals(pid, isCatchup, briefDate),
      loadRecentFeedback(pid),
      loadPriorContinuity(pid, briefDate),
      loadPidState(pid),
      loadAnsweredClarifications(pid),
      loadSopFlags(pid),
    ]);

    if (!project) { console.log('SKIP (project not found)'); failed++; continue; }
    if (signals.length === 0) {
      // Silence-brief path: active Planning In-Progress PIDs with an assigned planner
      // still need a brief — silence is the signal. Skip terminal/paused/Sales WIP.
      const isActive = project.planning_status === 'Planning In-Progress';
      const hasPlanner = Boolean(project.planner);
      if (!isActive || !hasPlanner) {
        console.log(`SKIP (no signals; status=${project.planning_status ?? 'null'}, planner=${project.planner ?? 'null'})`);
        failed++;
        continue;
      }
      const lastSignalAt = await loadLastSignalDate(pid);
      const silenceBrief = buildSilenceBrief(project, lastSignalAt, briefDate, pidState);
      try {
        await writeToDB(pid, briefDate, silenceBrief, { input_tokens: 0, output_tokens: 0 }, isCatchup);
        writeMarkdownFiles(project, silenceBrief, briefDate, isCatchup);
      } catch (err) {
        console.log(`FAILED (silence write: ${err instanceof Error ? err.message : err})`);
        failed++;
        continue;
      }
      console.log(`SILENCE  cold ${silenceBrief.client_pulse.days_silent}d  phase=${silenceBrief.phase}`);
      ok++;
      continue;
    }

    const userPrompt = buildUserPrompt(project, senders, signals, feedback, continuity, pidState, answeredClarifications, sopFlags, isCatchup, briefDate);
    const result = await callT1(userPrompt);

    if (!result) { console.log('FAILED (T1 error)'); failed++; continue; }

    if (result.brief.ai_clarification.length > 3) {
      result.brief.ai_clarification = result.brief.ai_clarification.slice(0, 3);
    }

    // Merge Haiku output with deterministic computed fields to form the full Brief JSON v2.
    const finalBrief: BriefJSON = {
      ...result.brief,
      phase: pidState?.phase ?? 'active_planning',
      runway_pct: pidState?.runway_pct ?? null,
      recovery_state: pidState?.recovery_entered_at
        ? {
            entered_at: pidState.recovery_entered_at,
            sustained_positive: pidState.recovery_sustained_positive,
            last_positive_marker_at: pidState.recovery_last_positive_marker_at,
          }
        : null,
      amaan_self_loop: computeAmaanSelfLoop(signals),
      designer_lane: computeDesignerLane(project, signals, senders),
      pm_lane: computePmLane(project, signals, senders, pidState?.phase ?? 'active_planning'),
      vm_lane: computeVmLane(signals),
      commercial_trail: [],
      phase_expectations: computePhaseExpectations(pidState),
      exceptional_pid_score: computeExceptionalPidScore(signals, senders),
    };

    // Post-gen validation: drop unack requests where asked_by is not a client.
    // Match on first-word case-insensitive prefix so "Dharmik" matches "Dharmik Patel"
    // or "Dharmik (Client)" in the resolved sender map.
    if (finalBrief.unacknowledged_requests.length > 0) {
      const firstWord = (s: string) => s.trim().split(/[\s(,]/)[0].toLowerCase();
      const clientFirstNames = new Set<string>();
      for (const [, info] of senders.byName) {
        if (info.role === 'client') clientFirstNames.add(firstWord(info.display_label));
      }
      for (const [, info] of senders.byWaId) {
        if (info.role === 'client') clientFirstNames.add(firstWord(info.display_label));
      }
      if (clientFirstNames.size > 0) {
        const before = finalBrief.unacknowledged_requests.length;
        finalBrief.unacknowledged_requests = finalBrief.unacknowledged_requests.filter(
          (r) => clientFirstNames.has(firstWord(r.asked_by)),
        );
        const dropped = before - finalBrief.unacknowledged_requests.length;
        if (dropped > 0) {
          process.stdout.write(` [dropped ${dropped} non-client unack]`);
        }
      }
    }

    try {
      await writeToDB(pid, briefDate, finalBrief, result.usage, isCatchup);
      writeMarkdownFiles(project, finalBrief, briefDate, isCatchup);
      await persistClarifications(pid, briefDate, isCatchup, finalBrief.ai_clarification);
    } catch (err) {
      console.log(`FAILED (write error: ${err instanceof Error ? err.message : err})`);
      failed++;
      continue;
    }

    totalInput += result.usage.input_tokens;
    totalOutput += result.usage.output_tokens;
    ok++;

    const sentiment = finalBrief.client_pulse.sentiment;
    const flags = finalBrief.cross_source_flags.length;
    const needs = finalBrief.needs_you.length;
    const selfLoop = finalBrief.amaan_self_loop.length;
    const clarif = finalBrief.ai_clarification.length;
    const badge = finalBrief.exceptional_pid_score.badge ? ' [STAR]' : '';
    console.log(
      `OK  ${sentiment.padEnd(8)} phase=${finalBrief.phase.padEnd(15)} ${result.usage.input_tokens}in/${result.usage.output_tokens}out` +
      `${flags ? `  flags: ${flags}` : ''}${needs ? `  actions: ${needs}` : ''}` +
      `${selfLoop ? `  self-loop: ${selfLoop}` : ''}${clarif ? `  ??: ${clarif}` : ''}${badge}`,
    );
  }

  const inputCost = (totalInput / 1_000_000) * 0.435;   // $0.435/1M input (DS V4 Pro)
  const outputCost = (totalOutput / 1_000_000) * 0.87;  // $0.87/1M output (DS V4 Pro)
  const totalUSD = inputCost + outputCost;

  console.log(`\n=== Done ===`);
  console.log(`OK: ${ok}  Failed: ${failed}`);
  console.log(`Tokens: ${totalInput.toLocaleString()} in / ${totalOutput.toLocaleString()} out`);
  console.log(`Est. cost: $${totalUSD.toFixed(4)} (~₹${(totalUSD * 84).toFixed(0)})`);
  console.log(`Markdown: ${VAULT_PATH}\\pids\\`);

  await supabase.from('cron_runs').insert({
    tier: 't1',
    started_at: new Date(start).toISOString(),
    finished_at: new Date().toISOString(),
    status: failed > 0 && ok === 0 ? 'failed' : failed > 0 ? 'partial' : 'completed',
    rows_written: ok,
    cost_inr: Math.round(totalUSD * 84 * 100) / 100,
  });
}

main().catch((err) => { console.error(err); process.exit(1); });
