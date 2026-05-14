import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { config } from 'dotenv';
import { resolve } from 'path';

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

type Role =
  | 'client' | 'team_lead' | 'planner' | 'designer'
  | 'project_manager' | 'rm' | 'vendor_manager'
  | 'meragi_other' | 'vendor' | 'unknown';

// --- Fuzzy first-name matching ---

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

// "~ Aayushi" → "aayushi"   |   "Bhavika Meragi" → "bhavika"
function normalizeFirst(name: string): string {
  return (
    name
      .replace(/^~\s*/, '')
      .replace(/\s+meragi\s*$/i, '')
      .trim()
      .toLowerCase()
      .split(/[\s_]+/)[0] ?? ''
  );
}

interface ProjectRow {
  cx_name: string | null;
  cx_name_studio: string | null;
  team_lead: string | null;
  planner: string | null;
  designer: string | null;
  project_manager: string | null;
  rm: string | null;
  vendor_manager: string | null;
}

function resolveFromProjects(
  senderName: string,
  project: ProjectRow,
): { role: Role; displayLabel: string } | null {
  const norm = normalizeFirst(senderName);
  if (!norm) return null;

  const roster: Array<{ name: string | null; role: Role; label: string }> = [
    { name: project.team_lead, role: 'team_lead', label: 'TL' },
    { name: project.planner, role: 'planner', label: 'Planner' },
    { name: project.designer, role: 'designer', label: 'Designer' },
    { name: project.project_manager, role: 'project_manager', label: 'PM' },
    { name: project.rm, role: 'rm', label: 'RM' },
    { name: project.vendor_manager, role: 'vendor_manager', label: 'VM' },
  ];

  for (const { name, role, label } of roster) {
    if (!name) continue;
    if (levenshtein(norm, normalizeFirst(name)) <= 2) {
      const first = name.replace(/^~\s*/, '').trim().split(/\s+/)[0];
      return { role, displayLabel: `${first} (${label})` };
    }
  }

  // Match couple names
  for (const field of [project.cx_name, project.cx_name_studio]) {
    if (!field) continue;
    for (const part of field.split(/\s*[&]\s*|\s+and\s+/i)) {
      const partNorm = normalizeFirst(part.trim());
      if (partNorm && levenshtein(norm, partNorm) <= 2) {
        const first = part.trim().split(/\s+/)[0];
        return { role: 'client', displayLabel: `${first} (Client)` };
      }
    }
  }

  return null;
}

// --- Pass 2: Haiku classification ---

// System prompt is identical across all calls — cache_control lets Haiku cache it
// (min 4096 tokens for caching; shorter prompts still work, just won't cache)
const SYSTEM_PROMPT = `You are a sender classifier for a wedding planning company (Meragi Celebrations).
Given a WhatsApp sender name, sample messages, and project roster, classify the sender's role.

Reply with ONLY valid JSON — no prose, no markdown:
{"role":"...","display_label":"...","confidence":"high|medium|low"}

Roles:
- client       : the couple getting married or their family
- team_lead    : Amaan or another TL leading the project
- planner      : planner managing day-to-day
- designer     : decor/design person
- project_manager : PM
- rm           : relationship manager
- vendor_manager  : vendor coordination
- meragi_other : another Meragi employee
- vendor       : external vendor (caterer, photographer, venue staff, etc.)
- unknown      : cannot determine

display_label format: "FirstName (Role)" e.g. "Aayushi (Client)", "Bhavika (Planner)", "XYZ Caterers (Vendor)"
For unknown, use the raw sender name as display_label.`;

interface LLMResult {
  role: Role;
  display_label: string;
  confidence: string;
}

async function resolveViaHaiku(
  pid: number,
  senderName: string,
  project: ProjectRow,
  samples: string[],
): Promise<LLMResult | null> {
  const roster = [
    project.team_lead && `TL: ${project.team_lead}`,
    project.planner && `Planner: ${project.planner}`,
    project.designer && `Designer: ${project.designer}`,
    project.project_manager && `PM: ${project.project_manager}`,
    project.rm && `RM: ${project.rm}`,
    project.vendor_manager && `VM: ${project.vendor_manager}`,
  ].filter(Boolean).join(' | ');

  const userPrompt =
    `PID ${pid} | Couple: ${project.cx_name ?? '?'} | Roster: ${roster || 'unknown'}\n\n` +
    `Sender name: "${senderName}"\n` +
    `Sample messages:\n${samples.slice(0, 30).map(m => `• ${m}`).join('\n')}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 128,
      system: [
        {
          type: 'text' as const,
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' as const },
        },
      ],
      messages: [{ role: 'user', content: userPrompt }],
    });

    const block = response.content.find((b) => b.type === 'text');
    if (!block || block.type !== 'text') return null;
    // Strip markdown code fences if Haiku wrapped the JSON
    const text = block.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    return JSON.parse(text) as LLMResult;
  } catch (err) {
    console.error(`    [haiku error] "${senderName}" PID ${pid}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

// --- Main ---

async function main() {
  // All distinct (pid, sender_name) pairs in signals
  // Paginate through signals — Supabase server-side cap is 1000 rows per request
  const seen = new Map<string, { pid: number; sender_name: string }>();
  let page = 0;
  const PAGE = 1000;
  while (true) {
    const { data: chunk, error: chunkErr } = await supabase
      .from('signals')
      .select('pid, sender_name')
      .not('sender_name', 'is', null)
      .range(page * PAGE, (page + 1) * PAGE - 1);
    if (chunkErr) { console.error('Failed to load signals page', page, chunkErr); process.exit(1); }
    if (!chunk || chunk.length === 0) break;
    for (const r of chunk) seen.set(`${r.pid}:${r.sender_name}`, { pid: r.pid as number, sender_name: r.sender_name as string });
    if (chunk.length < PAGE) break;
    page++;
  }
  const allPairs = [...seen.values()];

  // Skip already-resolved pairs (preserves manual edits)
  const { data: existing } = await supabase.from('signal_senders').select('pid, sender_name');
  const resolvedKeys = new Set((existing ?? []).map((r) => `${r.pid}:${r.sender_name}`));
  const todo = allPairs.filter((p) => !resolvedKeys.has(`${p.pid}:${p.sender_name}`));

  console.log(`Pairs total: ${allPairs.length} | already resolved: ${resolvedKeys.size} | to process: ${todo.length}`);
  if (todo.length === 0) { console.log('Nothing to do.'); return; }

  // Group by PID
  const byPid = new Map<number, string[]>();
  for (const { pid, sender_name } of todo) {
    if (!byPid.has(pid)) byPid.set(pid, []);
    byPid.get(pid)!.push(sender_name);
  }

  type Row = {
    pid: number;
    sender_name: string;
    role: Role;
    display_label: string | null;
    resolved_via: 'auto_projects' | 'auto_llm';
    resolved_at: string;
  };

  const rows: Row[] = [];
  const manualQueue: Array<{ pid: number; sender_name: string }> = [];
  const now = new Date().toISOString();

  const passCount = { projects: 0, haiku: 0, unknown: 0 };

  for (const [pid, senders] of byPid) {
    const { data: project } = await supabase
      .from('projects')
      .select('cx_name, cx_name_studio, team_lead, planner, designer, project_manager, rm, vendor_manager')
      .eq('pid', pid)
      .single<ProjectRow>();

    if (!project) {
      senders.forEach((s) => {
        rows.push({ pid, sender_name: s, role: 'unknown', display_label: null, resolved_via: 'auto_llm', resolved_at: now });
        manualQueue.push({ pid, sender_name: s });
        passCount.unknown++;
      });
      continue;
    }

    console.log(`\nPID ${pid} — ${senders.length} new sender(s):`);

    for (const senderName of senders) {
      // Pass 1 — fuzzy match from projects roster
      const p1 = resolveFromProjects(senderName, project);
      if (p1) {
        console.log(`  [projects]  "${senderName}" → ${p1.role}  "${p1.displayLabel}"`);
        rows.push({ pid, sender_name: senderName, role: p1.role, display_label: p1.displayLabel, resolved_via: 'auto_projects', resolved_at: now });
        passCount.projects++;
        continue;
      }

      // Pass 2 — Haiku with sample messages
      const { data: msgRows } = await supabase
        .from('signals')
        .select('body')
        .eq('pid', pid)
        .eq('sender_name', senderName)
        .not('body', 'is', null)
        .order('sent_at', { ascending: false })
        .limit(30);

      const samples = (msgRows ?? []).map((m) => m.body as string).filter(Boolean);
      const p2 = await resolveViaHaiku(pid, senderName, project, samples);

      if (p2 && p2.role !== 'unknown') {
        console.log(`  [haiku/${p2.confidence}]  "${senderName}" → ${p2.role}  "${p2.display_label}"`);
        rows.push({ pid, sender_name: senderName, role: p2.role, display_label: p2.display_label, resolved_via: 'auto_llm', resolved_at: now });
        passCount.haiku++;
      } else {
        console.log(`  [unknown]   "${senderName}" — needs manual review`);
        rows.push({ pid, sender_name: senderName, role: 'unknown', display_label: senderName, resolved_via: 'auto_llm', resolved_at: now });
        manualQueue.push({ pid, sender_name: senderName });
        passCount.unknown++;
      }
    }
  }

  // Write to DB
  const { error } = await supabase
    .from('signal_senders')
    .upsert(rows, { onConflict: 'pid,sender_name', ignoreDuplicates: true });

  if (error) { console.error('Upsert error:', error); process.exit(1); }

  console.log(`\n=== Done ===`);
  console.log(`  auto_projects : ${passCount.projects}`);
  console.log(`  auto_llm      : ${passCount.haiku}`);
  console.log(`  unknown       : ${passCount.unknown}`);

  if (manualQueue.length > 0) {
    console.log(`\nManual review needed (${manualQueue.length}):`);
    for (const { pid, sender_name } of manualQueue) {
      console.log(
        `  UPDATE public.signal_senders SET role='...', display_label='...' ` +
        `WHERE pid=${pid} AND sender_name='${sender_name.replace(/'/g, "''")}';`,
      );
    }
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
