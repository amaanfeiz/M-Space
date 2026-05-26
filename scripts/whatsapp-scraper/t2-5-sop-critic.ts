// Phase 1 — Step 12: T2.5 SOP critic tier (Sonnet 4.6)
//
// Runs after T1 + lexical-flags. Picks the PIDs with severity >= medium flags
// (from sop_flags, which unions collection_lag + planner_silent + lexical hits)
// and asks Sonnet to critique each: which SOPs are being violated, what
// evidence supports each violation, and what ladder step Amaan should consider.
//
// The critic is FORBIDDEN from drafting messages, recovery scripts, or founder
// escalations (handoff rule 19). It only identifies state + ladder step.
//
// Usage:
//   npx tsx t2-5-sop-critic.ts                  # today
//   npx tsx t2-5-sop-critic.ts --date=2026-05-22

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { config } from 'dotenv';
import { resolve } from 'path';
import { todayIstYmd } from '../../lib/utils/brief-date';

config({ path: resolve(process.cwd(), '../../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY not set');
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const args = process.argv.slice(2);
const dateArg = args.find((a) => a.startsWith('--date='))?.replace('--date=', '');
const BRIEF_DATE = dateArg ?? todayIstYmd();
const forceRun = args.includes('--force');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Sop = {
  sop_id: string;
  stage: string;
  role: string;
  category: string;
  title: string;
  body: string;
  framework_source: string | null;
};

type SopFlag = {
  pid: number;
  flag: string;
  severity: string;
  detail: string;
};

type BriefRow = {
  id: string;
  pid: number;
  brief_json: unknown;
};

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------

async function loadFlaggedPids(): Promise<number[]> {
  const { data } = await supabase
    .from('sop_flags')
    .select('pid, severity')
    .in('severity', ['high', 'critical']);
  const pids = new Set<number>();
  for (const row of data ?? []) {
    pids.add(row.pid as number);
  }
  return Array.from(pids).sort();
}

async function loadBriefForCritique(pid: number): Promise<BriefRow | null> {
  const { data } = await supabase
    .from('briefs')
    .select('id, pid, brief_json')
    .eq('pid', pid)
    .eq('brief_date', BRIEF_DATE)
    .eq('is_catchup', false)
    .maybeSingle<BriefRow>();
  return data;
}

async function loadFlagsForPid(pid: number): Promise<SopFlag[]> {
  const { data } = await supabase
    .from('sop_flags')
    .select('pid, flag, severity, detail')
    .eq('pid', pid);
  return (data ?? []) as SopFlag[];
}

async function loadSops(phase: string | undefined): Promise<Sop[]> {
  const PHASE_STAGE_MAP: Record<string, string[]> = {
    sales_wip: ['Onboarding', 'Triage', 'Dashboard'],
    onboarding: ['Onboarding', 'Client Communication', 'Triage', 'Dashboard', 'Sentiment'],
    active_planning: ['Active Planning', 'Client Communication', 'Collections', 'Vendor Optioning', 'Vendor Closure', 'Client Sentiment', 'Sentiment', 'Triage', 'Escalation', 'Planner Management', 'Cancellation Risk', 'Vendor Sourcing'],
    mid_runway: ['Active Planning', 'Client Communication', 'Collections', 'Vendor Closure', 'Vendor Optioning', 'Client Sentiment', 'Sentiment', 'Triage', 'Escalation', 'Planner Management', 'Cancellation Risk', 'Vendor Sourcing', 'Recovery'],
    final_quarter: ['Final Planning', 'Collections', 'Licenses', 'Client Communication', 'Vendor Closure', 'Client Sentiment', 'Sentiment', 'Triage', 'Escalation', 'Planner Management', 'Recovery'],
    post_event: ['Post-Event'],
    paused: ['Client Communication', 'Client Sentiment', 'Triage', 'Sentiment'],
    cancelled: ['Post-Event'],
  };
  const stages = PHASE_STAGE_MAP[phase ?? 'active_planning'] ?? PHASE_STAGE_MAP.active_planning;

  const { data } = await supabase
    .from('sops')
    .select('sop_id, stage, role, category, title, body, framework_source')
    .in('stage', stages)
    .eq('active', true);
  return (data ?? []) as Sop[];
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are the SOP critic for Amaan, Team Lead at Meragi Celebrations (Indian destination weddings). You audit one PID's daily brief against the team's normalized SOPs and surface violations with the lowest-appropriate intervention step.

## What you do
1. Read the brief + the relevant SOPs + the live flags.
2. Identify SOP violations supported by evidence in the brief or flags.
3. Score severity per violation (low | medium | high | critical) using the handoff's two-axis triage: category severity x client-experience.
4. For each violation, cite source group when relevant (internal vs client) — same content has inverted severity by source. CP/SP discussion in internal group is healthy; in client group is severity-1.
5. Recommend one overall ladder step: monitor | internal_nudge | direct_call | tl_visible | reassign.
6. If proactive surface + client mirroring + collaborative framing markers are present, list them under exceptional_markers.

## Hard rules (handoff rule 19)
- NEVER draft messages, recovery scripts, founder-escalation packets, or sharp-tone language.
- NEVER recommend founder escalation. Cancellation risk and pricing-wall escalation are Amaan-owned synthesis — your job ends at the flag.
- Surface state and ladder step; let Amaan write the response.

## Ladder steps (ascending)
- monitor — watch, no action this cycle
- internal_nudge — short message in internal PID group
- direct_call — TL phones the planner (after 2 ignored nudges, or thread optics demand it)
- tl_visible — TL enters the client group (rare; only when trust is damaged)
- reassign — team swap (worst case before escalation)

## Cross-group context can de-flag
If the internal group has explained a client-group anomaly within 72h (designer unwell, vendor confirmed off-channel, etc.), do NOT flag the client-group signal. Note the explanation instead.

## Output schema (JSON)
{
  "violations": [
    {
      "sop_id": "SOP-XX",
      "severity": "low|medium|high|critical",
      "evidence": "one-line evidence with source group + speaker if relevant",
      "ladder_step": "monitor|internal_nudge|direct_call|tl_visible|reassign"
    }
  ],
  "exceptional_markers": [
    {
      "axis": "proactive_surface|client_mirroring|collaborative_framing",
      "evidence": "one-line evidence"
    }
  ],
  "ladder_recommendation": "monitor|internal_nudge|direct_call|tl_visible|reassign",
  "summary": "one short sentence (max 150 chars) — the headline operator-grade take"
}`;

function buildUserPrompt(pid: number, brief: unknown, sops: Sop[], flags: SopFlag[]): string {
  const b = brief as Record<string, unknown>;
  const flagsList = flags.length === 0
    ? '(no live flags)'
    : flags.map((f) => `[${f.severity}] ${f.flag} — ${f.detail}`).join('\n');

  const sopsList = sops.map((s) => `${s.sop_id} (${s.role}, ${s.category}) — ${s.title}\n  Body: ${s.body}\n  Framework: ${s.framework_source ?? '—'}`).join('\n\n');

  return `PID: ${pid}  BRIEF DATE: ${BRIEF_DATE}

=== BRIEF JSON ===
${JSON.stringify(b, null, 2)}

=== LIVE FLAGS (sop_flags view, includes lexical pre-pass) ===
${flagsList}

=== RELEVANT SOPS (filtered by phase) ===
${sopsList}

=== TASK ===
Audit the brief against the SOPs above. Surface violations with evidence + ladder step. List exceptional markers if present. Recommend one overall ladder step. Emit the JSON schema described in the system prompt.`;
}

// ---------------------------------------------------------------------------
// Sonnet call
// ---------------------------------------------------------------------------

const CRITIQUE_SCHEMA = {
  type: 'object',
  properties: {
    violations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          sop_id: { type: 'string' },
          severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          evidence: { type: 'string' },
          ladder_step: { type: 'string', enum: ['monitor', 'internal_nudge', 'direct_call', 'tl_visible', 'reassign'] },
        },
        required: ['sop_id', 'severity', 'evidence', 'ladder_step'],
        additionalProperties: false,
      },
    },
    exceptional_markers: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          axis: { type: 'string', enum: ['proactive_surface', 'client_mirroring', 'collaborative_framing'] },
          evidence: { type: 'string' },
        },
        required: ['axis', 'evidence'],
        additionalProperties: false,
      },
    },
    ladder_recommendation: {
      type: 'string',
      enum: ['monitor', 'internal_nudge', 'direct_call', 'tl_visible', 'reassign'],
    },
    summary: { type: 'string' },
  },
  required: ['violations', 'exceptional_markers', 'ladder_recommendation', 'summary'],
  additionalProperties: false,
};

type CritiqueResult = {
  violations: Array<{ sop_id: string; severity: string; evidence: string; ladder_step: string }>;
  exceptional_markers: Array<{ axis: string; evidence: string }>;
  ladder_recommendation: string;
  summary: string;
};

async function callSonnet(userPrompt: string): Promise<{ result: CritiqueResult; usage: { input_tokens: number; output_tokens: number } } | null> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      temperature: 0.2,
      system: [
        { type: 'text' as const, text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' as const } },
      ],
      messages: [{ role: 'user', content: userPrompt }],
      output_config: {
        format: { type: 'json_schema', schema: CRITIQUE_SCHEMA },
      },
    });

    const u = response.usage as unknown as Record<string, number>;
    if (u.cache_creation_input_tokens || u.cache_read_input_tokens) {
      process.stdout.write(` cache[w:${u.cache_creation_input_tokens ?? 0}/r:${u.cache_read_input_tokens ?? 0}]`);
    }
    const block = response.content.find((b) => b.type === 'text');
    if (!block || block.type !== 'text') return null;
    const text = block.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const result = JSON.parse(text) as CritiqueResult;
    return {
      result,
      usage: { input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens },
    };
  } catch (err) {
    console.error('Sonnet error:', err instanceof Error ? err.message : err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`T2.5 SOP critic — brief_date: ${BRIEF_DATE}\n`);

  if (!forceRun) {
    const { data: prior } = await supabase
      .from('cron_runs')
      .select('id')
      .eq('tier', 't2_5')
      .eq('status', 'completed')
      .gte('started_at', BRIEF_DATE + 'T00:00:00+05:30')
      .lt('started_at', BRIEF_DATE + 'T24:00:00+05:30')
      .limit(1);
    if (prior && prior.length > 0) {
      console.log(`T2.5 already completed for ${BRIEF_DATE}. Use --force to re-run.`);
      return;
    }
  }

  const flaggedPids = await loadFlaggedPids();
  console.log(`Flagged PIDs to critique: ${flaggedPids.length}`);

  let processed = 0;
  let totalIn = 0;
  let totalOut = 0;

  for (const pid of flaggedPids) {
    process.stdout.write(`PID ${pid}... `);

    const brief = await loadBriefForCritique(pid);
    if (!brief) {
      console.log('SKIP (no brief)');
      continue;
    }

    const flags = await loadFlagsForPid(pid);
    const phase = ((brief.brief_json as Record<string, unknown>).phase as string) ?? 'active_planning';
    const sops = await loadSops(phase);

    const userPrompt = buildUserPrompt(pid, brief.brief_json, sops, flags);
    const sonnetOut = await callSonnet(userPrompt);

    if (!sonnetOut) {
      console.log('FAILED (Sonnet)');
      continue;
    }

    const { error } = await supabase.from('brief_sop_critique').upsert(
      {
        brief_id: brief.id,
        pid,
        brief_date: BRIEF_DATE,
        violations: sonnetOut.result.violations,
        exceptional_markers: sonnetOut.result.exceptional_markers,
        ladder_recommendation: sonnetOut.result.ladder_recommendation,
        summary: sonnetOut.result.summary,
        model: 'claude-sonnet-4-6',
        input_tokens: sonnetOut.usage.input_tokens,
        output_tokens: sonnetOut.usage.output_tokens,
      },
      { onConflict: 'pid,brief_date' },
    );

    if (error) {
      console.log(`FAILED (write: ${error.message})`);
      continue;
    }

    processed++;
    totalIn += sonnetOut.usage.input_tokens;
    totalOut += sonnetOut.usage.output_tokens;

    const v = sonnetOut.result.violations.length;
    const x = sonnetOut.result.exceptional_markers.length;
    console.log(`OK  ladder=${sonnetOut.result.ladder_recommendation.padEnd(14)} violations=${v} markers=${x}  ${sonnetOut.usage.input_tokens}in/${sonnetOut.usage.output_tokens}out`);
  }

  // Cost: Sonnet 4.6 = $3/$15 per M tokens
  const usd = (totalIn / 1_000_000) * 3 + (totalOut / 1_000_000) * 15;
  console.log(`\n=== Done ===`);
  console.log(`Processed: ${processed}/${flaggedPids.length}`);
  console.log(`Tokens: ${totalIn.toLocaleString()} in / ${totalOut.toLocaleString()} out`);
  console.log(`Est. cost: $${usd.toFixed(4)} (~₹${(usd * 84).toFixed(0)})`);

  await supabase.from('cron_runs').insert({
    tier: 't2_5',
    started_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
    status: 'completed',
    rows_written: processed,
    cost_inr: Math.round(usd * 84 * 100) / 100,
  });
}

main().catch((err) => {
  console.error('FATAL:', err instanceof Error ? err.message : err);
  process.exit(1);
});
