import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { config } from 'dotenv';
import { resolve } from 'path';
import { writeFileSync, mkdirSync } from 'fs';

config({ path: resolve(process.cwd(), '../../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY not set in .env.local');
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const VAULT_PATH =
  process.env.VAULT_PATH ?? 'C:\\Users\\Amaan\\Obsidian\\Meragi-Intel';

const ALL_AMAAN_PIDS = [
  24292, 28172, 33798, 19935, 20614, 24202, 24401, 25210, 26903, 30646,
  30969, 32125, 29662, 32245, 33487, 31341, 23671, 28438, 28166, 29568,
  28698, 21491, 33797, 28625, 30731, 33673, 33565, 31574, 33313, 33867, 34002,
];

// --- CLI args ---
const args = process.argv.slice(2);
const isCatchup = args.includes('--catchup');
const allMine = args.includes('--all-mine');
const pidArg = args.find((a) => a.startsWith('--pid='))?.replace('--pid=', '');

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
interface BriefJSON {
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
    action: string;
    priority: 'urgent' | 'soon' | 'when_able';
  }>;
  open_questions: {
    clarification_message: string;
  };
  cross_source_flags: Array<{
    flag: string;
    chat_says: string;
    tracker_says: string;
  }>;
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
          action: { type: 'string' },
          priority: { type: 'string', enum: ['urgent', 'soon', 'when_able'] },
        },
        required: ['action', 'priority'],
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
  },
  required: ['client_pulse', 'team_status', 'what_changed', 'commitments', 'needs_you', 'open_questions', 'cross_source_flags'],
  additionalProperties: false,
};

// --- System prompt (cached across all PID calls in a run) ---
const SYSTEM_PROMPT = `You generate daily project intelligence briefs for Amaan, Team Lead at Meragi Celebrations — an Indian destination wedding company. Amaan manages 4 sub-teams across destination weddings.

## Your job
Read the project context (hard facts from the tracker) and WhatsApp chat signals (from the client group and internal planning group), then produce a structured JSON brief.

## Hard rules
1. NEVER assert payment amounts, package prices, GMV, or exact dates as facts derived from chat — these come only from the tracker fields labelled "TRACKER:".
2. EVERY soft-signal claim (client_pulse summary, what_changed items, commitment owner, etc.) must end with [Display Label, DD MMM] attribution showing who said it and when.
3. If evidence is thin (e.g. only 2 messages), reflect low confidence. Do not pad sections.
4. COMMITMENTS: extract only explicit promises ("I'll send X by Friday", "We'll confirm by Monday"). Not vague intentions.
5. OPEN QUESTIONS: compose a SINGLE WhatsApp message for Amaan to send to the PID group. Start with "Hey @[planner first name]," then a short opener (vary — Amaan sends these every 1-2 days, never repeat the same opener). Then a numbered list — each point tied to specific chat evidence. Rules: (a) Every point must be a DIRECTIVE to the recipient, never a question back at Amaan ("should we do X?" is forbidden — replace with "please do X" or "what is the status of X?"). (b) Write as if the planner may not be around tomorrow — leave zero ambiguity, enough detail for anyone to pick this up and act. (c) If a cx message was ignored, state it plainly and ask for the response/resolution — do not soften. (d) If collection is low and no payment has moved, include the exact collected amount (from TRACKER) and ask when the next instalment is expected. (e) No emojis, no warm padding. If there is nothing to clarify, set clarification_message to an empty string.
6. CROSS-SOURCE FLAGS: only raise a flag when chat clearly contradicts a tracker field you've been given. Do not flag speculative differences.
7. NEEDS YOU: surface only things that genuinely require Amaan's decision or action. Not routine updates.

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

Format: "Hey @[first name], [opener].\n1. ...\n2. ..."

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
"Pandit profiles were requested on [date], what's the progress here? Please make sure we're not leaving open points like this."

Bad (do not do):
- Em dashes anywhere
- "Should we follow up again or wait?" (self-consultation)
- Corporate stiffness ("please confirm receipt", "kindly revert")
- Vague asks not tied to specific dates or events
- % for collection, always use ₹ amount from TRACKER

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
  current_summary: string | null;
  t_days: number | null;
  d_days: number | null;
  sentiment: string | null;
  overall_risk_summary: string | null;
}

async function loadProject(pid: number): Promise<ProjectRow | null> {
  const { data, error } = await supabase
    .from('projects')
    .select(`pid, cx_name, cx_name_studio, event_start_date, event_end_date,
             venue, region, team_lead, planner, designer, project_manager, rm, vendor_manager,
             package_price_eff, collection_pct, bgmv, project_health, cancellation_risk,
             current_summary, t_days, d_days, sentiment, overall_risk_summary`)
    .eq('pid', pid)
    .single<ProjectRow>();
  if (error) { console.error(`  project load error:`, error.message); return null; }
  return data;
}

async function loadSenders(pid: number): Promise<Map<string, { display_label: string; role: string }>> {
  const { data } = await supabase
    .from('signal_senders')
    .select('sender_name, display_label, role')
    .eq('pid', pid);
  const map = new Map<string, { display_label: string; role: string }>();
  for (const row of data ?? []) {
    if (row.display_label) map.set(row.sender_name, { display_label: row.display_label, role: row.role });
  }
  return map;
}

interface SignalRow {
  sender_name: string | null;
  body: string | null;
  sent_at: string;
  chat_type: string | null;
}

async function loadSignals(pid: number, catchup: boolean): Promise<SignalRow[]> {
  const cutoff = catchup
    ? new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year
    : new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(); // 14 days

  const { data } = await supabase
    .from('signals')
    .select('sender_name, body, sent_at, chat_type')
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
  senders: Map<string, { display_label: string; role: string }>,
  signals: SignalRow[],
  catchup: boolean,
  briefDate: string,
): string {
  const rupees = (v: string | null) =>
    v ? `₹${(parseFloat(v) / 100000).toFixed(1)}L` : '—';

  const collectedAmount = (() => {
    const pkg = parseFloat(project.package_price_eff ?? '0');
    const pct = parseFloat(project.collection_pct ?? '0');
    if (!pkg || !pct) return null;
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
  const allSignalLines = signals.map((sig) => {
    const senderKey = sig.sender_name ?? '';
    const senderInfo = senders.get(senderKey);
    const label = senderInfo?.display_label ?? senderKey ?? 'Unknown';
    const groupTag = sig.chat_type === 'client' ? '[client]' : '[internal]';
    return `[${formatDate(sig.sent_at)} ${formatTime(sig.sent_at)}] ${groupTag} ${label}: ${sig.body}`;
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
TRACKER: Risk summary: ${project.overall_risk_summary ?? '—'}

=== KNOWN SENDERS (from resolved roster) ===
${[...senders.values()].map((s) => `${s.display_label} (${s.role})`).join(', ') || 'none resolved'}

=== CHAT SIGNALS ===
Mode: ${mode}
Messages in window: ${signals.length} (showing ${lines.length} after truncation)

${lines.join('\n')}

=== TASK ===
Generate the JSON brief for PID ${project.pid} (${project.cx_name ?? '?'}).`;
}

// --- Haiku call ---

async function callHaiku(userPrompt: string): Promise<{ brief: BriefJSON; usage: { input_tokens: number; output_tokens: number } } | null> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      temperature: 0,
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
          schema: BRIEF_SCHEMA,
        },
      },
    });

    const block = response.content.find((b) => b.type === 'text');
    if (!block || block.type !== 'text') return null;

    const text = block.text.trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '');

    const brief = JSON.parse(text) as BriefJSON;
    return {
      brief,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
    };
  } catch (err) {
    console.error(`  Haiku error:`, err instanceof Error ? err.message : err);
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
      model: 'claude-haiku-4-5-20251001',
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
    `**Event:** ${project.event_start_date ?? '?'}${project.event_end_date && project.event_end_date !== project.event_start_date ? ' → ' + project.event_end_date : ''} · ${project.venue ?? '?'} · ${daysLabel}`,
    `**Package:** ${rupees(project.package_price_eff)} · Collection ${project.collection_pct ?? '?'}% · Health ${project.project_health ?? '?'}/5 · Cancel risk ${project.cancellation_risk ?? '?'}/5`,
    `**Team:** ${[project.team_lead, project.planner, project.designer, project.project_manager].filter(Boolean).join(' · ')}`,
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
    `## Needs You`,
    ...(brief.needs_you.length
      ? brief.needs_you.map((n) => `- [${n.priority}] ${n.action}`)
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
  ];

  return lines.join('\n');
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
  const briefDate = new Date().toISOString().slice(0, 10);
  const mode = isCatchup ? 'CATCH-UP' : 'DAILY';

  console.log(`\nGenerating ${mode} briefs for ${targetPids.length} PID(s) — ${briefDate}`);
  console.log(`Model: claude-haiku-4-5-20251001  T=0  Cache: on\n`);

  let ok = 0, failed = 0;
  let totalInput = 0, totalOutput = 0;

  for (const pid of targetPids) {
    process.stdout.write(`PID ${pid}... `);

    const [project, senders, signals] = await Promise.all([
      loadProject(pid),
      loadSenders(pid),
      loadSignals(pid, isCatchup),
    ]);

    if (!project) { console.log('SKIP (project not found)'); failed++; continue; }
    if (signals.length === 0) { console.log('SKIP (no signals in window)'); failed++; continue; }

    const userPrompt = buildUserPrompt(project, senders, signals, isCatchup, briefDate);
    const result = await callHaiku(userPrompt);

    if (!result) { console.log('FAILED (Haiku error)'); failed++; continue; }

    try {
      await writeToDB(pid, briefDate, result.brief, result.usage, isCatchup);
      writeMarkdownFiles(project, result.brief, briefDate, isCatchup);
    } catch (err) {
      console.log(`FAILED (write error: ${err instanceof Error ? err.message : err})`);
      failed++;
      continue;
    }

    totalInput += result.usage.input_tokens;
    totalOutput += result.usage.output_tokens;
    ok++;

    const sentiment = result.brief.client_pulse.sentiment;
    const flags = result.brief.cross_source_flags.length;
    const needs = result.brief.needs_you.length;
    console.log(
      `OK  ${sentiment.padEnd(8)} ${result.usage.input_tokens}in/${result.usage.output_tokens}out` +
      `${flags ? `  flags: ${flags}` : ''}${needs ? `  actions: ${needs}` : ''}`,
    );
  }

  const inputCost = (totalInput / 1_000_000) * 1.00;   // $1/1M input
  const outputCost = (totalOutput / 1_000_000) * 5.00;  // $5/1M output
  const totalUSD = inputCost + outputCost;

  console.log(`\n=== Done ===`);
  console.log(`OK: ${ok}  Failed: ${failed}`);
  console.log(`Tokens: ${totalInput.toLocaleString()} in / ${totalOutput.toLocaleString()} out`);
  console.log(`Est. cost: $${totalUSD.toFixed(4)} (~₹${(totalUSD * 84).toFixed(0)})`);
  console.log(`Markdown: ${VAULT_PATH}\\pids\\`);
}

main().catch((err) => { console.error(err); process.exit(1); });
