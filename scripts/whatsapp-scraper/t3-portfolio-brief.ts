// T3 — Portfolio strategic brief (Opus 4.7)
//
// Reads today's per-PID briefs + sop_flags, asks Opus to produce a compact
// structured portfolio brief, writes to public.portfolio_briefs, and renders
// a markdown copy into the Obsidian vault under portfolio/<date>.md.
//
// v1 skips:
//   - T2 reference compression (Opus can swallow ~30 briefs directly)
//   - Counterfactuals from clarification_evaluations (table empty until T1b)
//   - Batch API (one-off manual run, real-time)
//
// Usage:
//   npx tsx t3-portfolio-brief.ts                   # today
//   npx tsx t3-portfolio-brief.ts --date=2026-05-20  # specific date

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { config } from 'dotenv';
import { resolve } from 'path';
import { writeFileSync, mkdirSync, existsSync } from 'fs';

config({ path: resolve(process.cwd(), '../../.env.local') });

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY not set in .env.local');
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const VAULT_PATH =
  process.env.VAULT_PATH ?? 'C:\\Users\\Amaan\\Obsidian\\Meragi-Intel';

// --- CLI args ---
const args = process.argv.slice(2);
const dateArg = args.find((a) => a.startsWith('--date='))?.replace('--date=', '');
const BRIEF_DATE = dateArg ?? new Date().toISOString().slice(0, 10);

console.log(`T3 portfolio brief for ${BRIEF_DATE}\n`);

// =====================================================================
// Output schema
// =====================================================================

interface PortfolioBriefJSON {
  executive_summary: string;
  patterns: Array<{
    pattern: string;
    pids: number[];
    severity: 'high' | 'medium' | 'low';
  }>;
  outliers: Array<{
    pid: number;
    cx_name: string;
    why: string;
  }>;
  predicted_escalations: Array<{
    pid: number;
    cx_name: string;
    likely_issue: string;
    window: string;
  }>;
  weekly_directives: string[];
  amaan_pattern_observations: string[];
  counterfactuals: Array<{
    days_ago: number;
    pid: number;
    suggested: string;
    happened: string;
    outcome: string;
  }>;
}

const PORTFOLIO_SCHEMA = {
  type: 'object',
  properties: {
    executive_summary: { type: 'string' },
    patterns: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          pattern: { type: 'string' },
          pids: { type: 'array', items: { type: 'integer' } },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: ['pattern', 'pids', 'severity'],
        additionalProperties: false,
      },
    },
    outliers: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          pid: { type: 'integer' },
          cx_name: { type: 'string' },
          why: { type: 'string' },
        },
        required: ['pid', 'cx_name', 'why'],
        additionalProperties: false,
      },
    },
    predicted_escalations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          pid: { type: 'integer' },
          cx_name: { type: 'string' },
          likely_issue: { type: 'string' },
          window: { type: 'string' },
        },
        required: ['pid', 'cx_name', 'likely_issue', 'window'],
        additionalProperties: false,
      },
    },
    weekly_directives: { type: 'array', items: { type: 'string' } },
    amaan_pattern_observations: { type: 'array', items: { type: 'string' } },
    counterfactuals: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          days_ago: { type: 'integer' },
          pid: { type: 'integer' },
          suggested: { type: 'string' },
          happened: { type: 'string' },
          outcome: { type: 'string' },
        },
        required: ['days_ago', 'pid', 'suggested', 'happened', 'outcome'],
        additionalProperties: false,
      },
    },
  },
  required: [
    'executive_summary',
    'patterns',
    'outliers',
    'predicted_escalations',
    'weekly_directives',
    'amaan_pattern_observations',
    'counterfactuals',
  ],
  additionalProperties: false,
};

// =====================================================================
// System prompt
// =====================================================================

const SYSTEM_PROMPT = `You are Amaan's strategic portfolio copilot. Amaan is Team Lead at Meragi Celebrations (Indian destination weddings), managing 4 sub-teams across roughly 30 active projects (PIDs). Each day he reads per-PID briefs that summarise what's happening. Your job is to read all of today's per-PID briefs together and produce a single compact strategic brief that tells him what's happening ACROSS the portfolio — not project-by-project.

## Hard rules

1. NEVER fabricate. Every claim must be supported by content in the per-PID briefs or the sop_flags input.
2. Patterns must cite at least 2 PIDs. Single-PID issues belong in "outliers", not "patterns".
3. PID numbers in patterns/outliers/escalations must be integers exactly as supplied — do not invent.
4. Be terse. No marketing language, no emojis, no exclamation marks. Treat Amaan as a sharp operator who is short on time.
5. If a category has nothing real to say, return an empty array. Do not pad.
6. counterfactuals: return an empty array. The data layer needed to compute these (clarification_evaluations) has no rows yet — it will populate from Phase 7.5 onwards. Do not attempt to invent counterfactuals from the per-PID briefs.

## Output fields

- executive_summary: 3–5 sentences. The shape of the portfolio today. What's the dominant theme. What's quietly working. What broke since the last brief. Written for Amaan's morning read.
- patterns: cross-PID issues. Each entry names the pattern, lists the PIDs that exhibit it, and severity. Examples: "Unanswered client collateral questions across 5 PIDs >3d", "Planner silence cluster on Bhavika's projects", "Collection lag on PIDs near T-day".
- outliers: PIDs that stand out from the rest. A single PID with anomalous sentiment shift, an unexpected escalation, a sudden positive signal worth amplifying. One sentence per.
- predicted_escalations: PIDs likely to escalate in the next 1–2 weeks based on trajectory in the briefs. Cite the trajectory (e.g., "sentiment moved cautious → anxious, collection lag widening, T-15 days").
- weekly_directives: 3–6 short imperative instructions for Amaan this week. Things he should *do*, not status. Order by priority.
- amaan_pattern_observations: meta — observations about Amaan's portfolio overall. ("Half the cautious-sentiment PIDs share the same planner." "Collection movement is stalled on every PID past T-60.") Skip unless you have a real observation.
- counterfactuals: [] for v1.

## Style

- Cite PIDs by integer plus a parenthetical couple-name first reference: "PID 25210 (Vienna & Ishan)". Subsequent references to the same PID can use either form.
- Numbers are facts. Use the tracker fields (collection %, T-day, health, cancel risk) when relevant, not approximations.
- "Days silent" / "Days unanswered" are taken from the per-PID briefs — quote them when relevant.
- If the SOP flags (deterministic engine) raised an issue, the brief should reflect it — the flags are pre-computed hard signals.`;

// =====================================================================
// Pull context from DB
// =====================================================================

interface BriefRow {
  pid: number;
  brief_date: string;
  brief_json: any;
  is_catchup: boolean;
  projects: {
    cx_name: string | null;
    team_lead: string | null;
    planner: string | null;
    designer: string | null;
    project_manager: string | null;
    t_days: number | null;
    d_days: number | null;
    event_start_date: string | null;
    event_end_date: string | null;
    venue: string | null;
    collection: number | null;
    collection_pct: number | null;
    package_price_eff: number | null;
    bgmv: number | null;
    project_health: number | null;
    cancellation_risk: number | null;
    sentiment: string | null;
    overall_pid_risk: string | null;
  } | null;
}

interface SopFlagRow {
  pid: number;
  flag: string;
  severity: string;
  detail: string;
}

async function pullContext(): Promise<{
  briefs: BriefRow[];
  flags: SopFlagRow[];
}> {
  const { data: briefs, error: briefsErr } = await supabase
    .from('briefs')
    .select(
      `pid, brief_date, brief_json, is_catchup,
       projects (
         cx_name, team_lead, planner, designer, project_manager,
         t_days, d_days, event_start_date, event_end_date, venue,
         collection, collection_pct, package_price_eff, bgmv,
         project_health, cancellation_risk, sentiment, overall_pid_risk
       )`,
    )
    .eq('brief_date', BRIEF_DATE)
    .order('pid', { ascending: true });

  if (briefsErr) throw new Error(`briefs query: ${briefsErr.message}`);
  if (!briefs || briefs.length === 0) {
    throw new Error(`No briefs found for ${BRIEF_DATE}. Run generate-brief.ts first.`);
  }

  const { data: flags, error: flagsErr } = await supabase
    .from('sop_flags')
    .select('pid, flag, severity, detail');

  if (flagsErr) throw new Error(`sop_flags query: ${flagsErr.message}`);

  return {
    briefs: briefs as unknown as BriefRow[],
    flags: (flags ?? []) as SopFlagRow[],
  };
}

// =====================================================================
// Build prompt
// =====================================================================

function rupees(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(1)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`;
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(0)}k`;
  return `₹${n}`;
}

function buildUserPrompt(briefs: BriefRow[], flags: SopFlagRow[]): string {
  const flagsByPid = new Map<number, SopFlagRow[]>();
  for (const f of flags) {
    if (!flagsByPid.has(f.pid)) flagsByPid.set(f.pid, []);
    flagsByPid.get(f.pid)!.push(f);
  }

  const pidBlocks = briefs.map((row) => {
    const p = row.projects;
    const b = row.brief_json;
    const pidFlags = flagsByPid.get(row.pid) ?? [];

    const tracker = [
      `pid: ${row.pid}`,
      `cx: ${p?.cx_name ?? '?'}`,
      `event: ${p?.event_start_date ?? '?'}${p?.event_end_date && p.event_end_date !== p.event_start_date ? ' → ' + p.event_end_date : ''}`,
      `t_days: ${p?.t_days ?? '?'}`,
      `venue: ${p?.venue ?? '?'}`,
      `team_lead: ${p?.team_lead ?? '?'} | planner: ${p?.planner ?? '?'} | designer: ${p?.designer ?? '?'} | pm: ${p?.project_manager ?? '?'}`,
      `package: ${rupees(p?.package_price_eff)} | bgmv: ${rupees(p?.bgmv)} | collection: ${rupees(p?.collection)} (${p?.collection_pct ?? '?'}%)`,
      `health: ${p?.project_health ?? '?'}/5 | cancel_risk: ${p?.cancellation_risk ?? '?'}/5 | overall: ${p?.overall_pid_risk ?? '?'}`,
    ].join(' · ');

    const flagsBlock =
      pidFlags.length > 0
        ? `SOP FLAGS:\n${pidFlags.map((f) => `  [${f.severity}] ${f.flag}: ${f.detail}`).join('\n')}\n`
        : '';

    return `--- PID ${row.pid}${row.is_catchup ? ' (catchup)' : ''} ---
TRACKER: ${tracker}
${flagsBlock}BRIEF JSON:
${JSON.stringify(b, null, 0)}
`;
  });

  return `TODAY: ${BRIEF_DATE} (Asia/Kolkata)

You are reading ${briefs.length} per-PID briefs from today plus ${flags.length} pre-computed SOP flags from the deterministic engine. Produce the portfolio brief.

${pidBlocks.join('\n')}

=== TASK ===
Produce the portfolio brief JSON for ${BRIEF_DATE} per the schema and rules.`;
}

// =====================================================================
// Call Opus
// =====================================================================

async function callOpus(userPrompt: string): Promise<{
  brief: PortfolioBriefJSON;
  usage: { input_tokens: number; output_tokens: number };
}> {
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 4096,
    system: [
      {
        type: 'text' as const,
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' as const },
      },
    ],
    messages: [{ role: 'user', content: userPrompt }],
    output_config: {
      format: {
        type: 'json_schema',
        schema: PORTFOLIO_SCHEMA,
      },
    },
  });

  const block = response.content.find((b) => b.type === 'text');
  if (!block || block.type !== 'text') {
    throw new Error('No text block in Opus response');
  }

  const text = block.text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');

  const brief = JSON.parse(text) as PortfolioBriefJSON;
  return {
    brief,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
  };
}

// =====================================================================
// Render markdown
// =====================================================================

function renderMarkdown(brief: PortfolioBriefJSON, date: string, nPids: number): string {
  const lines: string[] = [];
  lines.push(`---`);
  lines.push(`brief_date: ${date}`);
  lines.push(`tier: T3`);
  lines.push(`model: claude-opus-4-7`);
  lines.push(`pids_covered: ${nPids}`);
  lines.push(`---`);
  lines.push('');
  lines.push(`# Portfolio Brief — ${date}`);
  lines.push('');
  lines.push(`## Executive summary`);
  lines.push('');
  lines.push(brief.executive_summary);
  lines.push('');

  if (brief.patterns.length > 0) {
    lines.push(`## Patterns`);
    lines.push('');
    for (const p of brief.patterns) {
      lines.push(`- **[${p.severity}]** ${p.pattern} — PIDs: ${p.pids.join(', ')}`);
    }
    lines.push('');
  }

  if (brief.outliers.length > 0) {
    lines.push(`## Outliers`);
    lines.push('');
    for (const o of brief.outliers) {
      lines.push(`- **PID ${o.pid}** (${o.cx_name}) — ${o.why}`);
    }
    lines.push('');
  }

  if (brief.predicted_escalations.length > 0) {
    lines.push(`## Predicted escalations`);
    lines.push('');
    for (const e of brief.predicted_escalations) {
      lines.push(`- **PID ${e.pid}** (${e.cx_name}) — ${e.likely_issue} · window: ${e.window}`);
    }
    lines.push('');
  }

  if (brief.weekly_directives.length > 0) {
    lines.push(`## Weekly directives`);
    lines.push('');
    brief.weekly_directives.forEach((d, i) => lines.push(`${i + 1}. ${d}`));
    lines.push('');
  }

  if (brief.amaan_pattern_observations.length > 0) {
    lines.push(`## Pattern observations`);
    lines.push('');
    for (const o of brief.amaan_pattern_observations) {
      lines.push(`- ${o}`);
    }
    lines.push('');
  }

  if (brief.counterfactuals.length > 0) {
    lines.push(`## Counterfactuals`);
    lines.push('');
    for (const c of brief.counterfactuals) {
      lines.push(`- **${c.days_ago}d ago, PID ${c.pid}** — suggested: "${c.suggested}" · happened: "${c.happened}" · outcome: ${c.outcome}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// =====================================================================
// Main
// =====================================================================

async function main() {
  console.log('Pulling per-PID briefs + SOP flags from DB...');
  const { briefs, flags } = await pullContext();
  console.log(`  ${briefs.length} briefs, ${flags.length} SOP flags loaded.\n`);

  console.log('Building Opus prompt...');
  const userPrompt = buildUserPrompt(briefs, flags);
  const promptKb = (Buffer.byteLength(userPrompt, 'utf8') / 1024).toFixed(1);
  console.log(`  prompt size: ${promptKb} KB\n`);

  console.log('Calling Opus 4.7...');
  const start = Date.now();
  const { brief, usage } = await callOpus(userPrompt);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(
    `  done in ${elapsed}s. tokens: ${usage.input_tokens.toLocaleString()} in / ${usage.output_tokens.toLocaleString()} out\n`,
  );

  // Cost estimate (Opus 4.7: $5/$25 per M tokens, INR @ 83, +25% tokenizer buffer)
  const usdCost =
    (usage.input_tokens / 1_000_000) * 5 + (usage.output_tokens / 1_000_000) * 25;
  const inrCost = usdCost * 83 * 1.25;
  console.log(`  est. cost: $${usdCost.toFixed(4)} (~₹${inrCost.toFixed(0)} with tokenizer buffer)\n`);

  console.log('Writing to portfolio_briefs...');
  const { error: upsertErr } = await supabase.from('portfolio_briefs').upsert({
    brief_date: BRIEF_DATE,
    brief_json: brief,
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
  });
  if (upsertErr) throw new Error(`portfolio_briefs upsert: ${upsertErr.message}`);
  console.log('  ok.\n');

  console.log('Writing markdown to vault...');
  const portfolioDir = resolve(VAULT_PATH, 'portfolio');
  if (!existsSync(portfolioDir)) mkdirSync(portfolioDir, { recursive: true });
  const mdPath = resolve(portfolioDir, `${BRIEF_DATE}.md`);
  writeFileSync(mdPath, renderMarkdown(brief, BRIEF_DATE, briefs.length), 'utf8');
  console.log(`  ${mdPath}\n`);

  console.log('Logging cron_runs entry...');
  await supabase.from('cron_runs').insert({
    tier: 't3',
    started_at: new Date(start).toISOString(),
    finished_at: new Date().toISOString(),
    status: 'completed',
    rows_written: 1,
    cost_inr: Number(inrCost.toFixed(2)),
  });
  console.log('  ok.\n');

  console.log('=== Done ===');
  console.log(
    `Portfolio brief for ${BRIEF_DATE}: ${briefs.length} PIDs covered, ${brief.patterns.length} patterns, ${brief.outliers.length} outliers, ${brief.predicted_escalations.length} predicted escalations.`,
  );
  console.log(`Read it: ${mdPath}`);
}

main().catch((err) => {
  console.error('FATAL:', err instanceof Error ? err.message : err);
  process.exit(1);
});
