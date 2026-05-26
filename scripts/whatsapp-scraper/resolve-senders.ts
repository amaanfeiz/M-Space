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

// Known spelling aliases — applied after first-name extraction
const NAME_ALIASES: Record<string, string> = {
  sreyanshu: 'shreyanshu',
};

// Normalize "~ Aayushi", "Bhavika Meragi", "Aditya Meragi RJ", "Meragi Sreyanshu",
// "Vaibhav RJ Meragi", "Amaan Personal" → first_name (lowercase, alias-applied)
function normalizeFirst(name: string): string {
  let s = name.replace(/^~\s*/, '').trim();
  // Strip "Meragi" prefix (e.g., "Meragi Sreyanshu" → "Sreyanshu")
  s = s.replace(/^meragi\s+/i, '');
  // Iteratively strip trailing tokens — handles "Aditya Meragi RJ" → "Aditya"
  let prev = '';
  while (prev !== s) {
    prev = s;
    s = s.replace(/\s+(meragi|rj|pm|vm\s+lead|vm|personal|lead|sales)\s*$/i, '');
  }
  const first = (s.toLowerCase().split(/[\s_]+/)[0] ?? '').replace(/[^a-z]/g, '');
  return NAME_ALIASES[first] ?? first;
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

// --- Pass 1.5: wa_contact_map lookup (preferred over Haiku for wa_id senders) ---

interface WaContact {
  wa_id: string;
  saved_name: string | null;
  pushname: string | null;
  is_my_contact: boolean | null;
}

async function loadWaContactMap(): Promise<Map<string, WaContact>> {
  const m = new Map<string, WaContact>();
  let from = 0;
  const page = 1000;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data } = await supabase
      .from('wa_contact_map')
      .select('wa_id, saved_name, pushname, is_my_contact')
      .range(from, from + page - 1);
    if (!data || data.length === 0) break;
    for (const r of data) m.set(r.wa_id as string, r as WaContact);
    if (data.length < page) break;
    from += page;
  }
  return m;
}

function resolveFromContactMap(
  contact: WaContact | undefined,
  project: ProjectRow,
): { role: Role; displayLabel: string } | null {
  if (!contact) return null;
  const rawName = contact.saved_name ?? contact.pushname;
  if (!rawName) return null;

  // Try matching the contact's name against the project roster
  const projectMatch = resolveFromProjects(rawName, project);
  if (projectMatch) return projectMatch;

  // Not in roster but saved in Amaan's contacts → another Meragi person
  if (contact.is_my_contact) {
    const first = normalizeFirst(rawName);
    if (!first) return null;
    const display = first.charAt(0).toUpperCase() + first.slice(1);
    return { role: 'meragi_other', displayLabel: `${display} (Meragi)` };
  }

  // External (client/vendor/etc) but we know their pushname — label honestly
  return { role: 'unknown', displayLabel: `${rawName} (Unknown)` };
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

// Known wa_ids — used for Pass 0 fast-path before fuzzy/Haiku
const TL_WA_ID = process.env.TL_WA_ID ?? '';

type Row = {
  pid: number;
  sender_name: string;   // for wa_id-only senders: stores the raw wa_id as key
  sender_wa_id: string | null;
  role: Role;
  display_label: string | null;
  resolved_via: 'auto_projects' | 'auto_llm' | 'wa_contact_map' | 'manual';
  resolved_at: string;
};

async function paginateSignals(
  filter: 'name' | 'wa_id',
): Promise<Map<string, { pid: number; senderName: string; waId: string | null }>> {
  const seen = new Map<string, { pid: number; senderName: string; waId: string | null }>();
  let page = 0;
  const PAGE = 1000;
  while (true) {
    let q = supabase.from('signals').select('pid, sender_name, sender_wa_id').range(page * PAGE, (page + 1) * PAGE - 1);
    if (filter === 'name') {
      q = q.not('sender_name', 'is', null);
    } else {
      q = q.is('sender_name', null).not('sender_wa_id', 'is', null);
    }
    const { data: chunk, error } = await q;
    if (error) { console.error('Failed to load signals page', page, error); process.exit(1); }
    if (!chunk || chunk.length === 0) break;
    for (const r of chunk) {
      const key = filter === 'name'
        ? `name:${r.pid}:${r.sender_name}`
        : `waid:${r.pid}:${r.sender_wa_id}`;
      seen.set(key, { pid: r.pid as number, senderName: r.sender_name as string, waId: r.sender_wa_id as string | null });
    }
    if (chunk.length < PAGE) break;
    page++;
  }
  return seen;
}

async function main() {
  const resolveStart = Date.now();
  // --- Collect distinct senders: by name (external groups) + by wa_id (internal groups) ---
  const [byNameSeen, byWaIdSeen, waContactMap] = await Promise.all([
    paginateSignals('name'),
    paginateSignals('wa_id'),
    loadWaContactMap(),
  ]);
  console.log(`Loaded ${waContactMap.size} wa_contact_map entries`);

  // Skip already-resolved pairs
  const { data: existing } = await supabase.from('signal_senders').select('pid, sender_name, sender_wa_id');
  const resolvedByName = new Set((existing ?? []).map((r) => `${r.pid}:${r.sender_name}`));
  const resolvedByWaId = new Set((existing ?? []).filter((r) => r.sender_wa_id).map((r) => `${r.pid}:${r.sender_wa_id}`));

  // name-keyed todo
  type NameTodo = { pid: number; senderName: string };
  const nameTodo: NameTodo[] = [...byNameSeen.values()]
    .filter((p) => !resolvedByName.has(`${p.pid}:${p.senderName}`))
    .map((p) => ({ pid: p.pid, senderName: p.senderName }));

  // wa_id-keyed todo (sender_name is null, use wa_id as the storage key)
  type WaIdTodo = { pid: number; waId: string };
  const waIdTodo: WaIdTodo[] = [...byWaIdSeen.values()]
    .filter((p) => p.waId && !resolvedByWaId.has(`${p.pid}:${p.waId}`))
    .map((p) => ({ pid: p.pid, waId: p.waId! }));

  console.log(`By-name: ${byNameSeen.size} total, ${nameTodo.length} to process`);
  console.log(`By-wa_id: ${byWaIdSeen.size} total, ${waIdTodo.length} to process`);
  if (nameTodo.length === 0 && waIdTodo.length === 0) { console.log('Nothing to do.'); return; }

  const rows: Row[] = [];
  const manualQueue: Array<{ pid: number; key: string }> = [];
  const now = new Date().toISOString();
  const passCount = { tl: 0, projects: 0, contact_map: 0, haiku: 0, unknown: 0 };

  // --- Process name-keyed senders ---
  const byPidName = new Map<number, string[]>();
  for (const { pid, senderName } of nameTodo) {
    if (!byPidName.has(pid)) byPidName.set(pid, []);
    byPidName.get(pid)!.push(senderName);
  }

  for (const [pid, senders] of byPidName) {
    const { data: project } = await supabase
      .from('projects')
      .select('cx_name, cx_name_studio, team_lead, planner, designer, project_manager, rm, vendor_manager')
      .eq('pid', pid)
      .single<ProjectRow>();

    if (!project) {
      for (const s of senders) {
        rows.push({ pid, sender_name: s, sender_wa_id: null, role: 'unknown', display_label: null, resolved_via: 'auto_llm', resolved_at: now });
        manualQueue.push({ pid, key: s });
        passCount.unknown++;
      }
      continue;
    }

    console.log(`\nPID ${pid} (by name) — ${senders.length} new sender(s):`);

    for (const senderName of senders) {
      const p1 = resolveFromProjects(senderName, project);
      if (p1) {
        console.log(`  [projects]  "${senderName}" → ${p1.role}  "${p1.displayLabel}"`);
        rows.push({ pid, sender_name: senderName, sender_wa_id: null, role: p1.role, display_label: p1.displayLabel, resolved_via: 'auto_projects', resolved_at: now });
        passCount.projects++;
        continue;
      }

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
        rows.push({ pid, sender_name: senderName, sender_wa_id: null, role: p2.role, display_label: p2.display_label, resolved_via: 'auto_llm', resolved_at: now });
        passCount.haiku++;
      } else {
        console.log(`  [unknown]   "${senderName}" — needs manual review`);
        rows.push({ pid, sender_name: senderName, sender_wa_id: null, role: 'unknown', display_label: senderName, resolved_via: 'auto_llm', resolved_at: now });
        manualQueue.push({ pid, key: senderName });
        passCount.unknown++;
      }
    }
  }

  // --- Process wa_id-keyed senders (null sender_name in signals) ---
  const byPidWaId = new Map<number, string[]>();
  for (const { pid, waId } of waIdTodo) {
    if (!byPidWaId.has(pid)) byPidWaId.set(pid, []);
    byPidWaId.get(pid)!.push(waId);
  }

  for (const [pid, waIds] of byPidWaId) {
    const { data: project } = await supabase
      .from('projects')
      .select('cx_name, cx_name_studio, team_lead, planner, designer, project_manager, rm, vendor_manager')
      .eq('pid', pid)
      .single<ProjectRow>();

    console.log(`\nPID ${pid} (by wa_id) — ${waIds.length} new sender(s):`);

    for (const waId of waIds) {
      // Pass 0 — known wa_ids from env (TL fast path)
      if (TL_WA_ID && waId === TL_WA_ID) {
        const tlName = project?.team_lead?.trim().split(/\s+/)[0] ?? 'TL';
        const label = `${tlName} (TL)`;
        console.log(`  [env/tl]    "${waId}" → team_lead  "${label}"`);
        rows.push({ pid, sender_name: waId, sender_wa_id: waId, role: 'team_lead', display_label: label, resolved_via: 'auto_projects', resolved_at: now });
        passCount.tl++;
        continue;
      }

      // Pass 1.5 — wa_contact_map (Amaan's saved WA contacts + pushname). Authoritative.
      // Skips Haiku for any wa_id we've already enriched via enrich-contacts.ts.
      if (project) {
        const contactMatch = resolveFromContactMap(waContactMap.get(waId), project);
        if (contactMatch) {
          console.log(
            `  [contact]   "${waId}" → ${contactMatch.role}  "${contactMatch.displayLabel}"`,
          );
          rows.push({
            pid,
            sender_name: waId,
            sender_wa_id: waId,
            role: contactMatch.role,
            display_label: contactMatch.displayLabel,
            resolved_via: 'wa_contact_map',
            resolved_at: now,
          });
          passCount.contact_map++;
          continue;
        }
      }

      // Pass 2 — Haiku fallback (only for wa_ids absent from wa_contact_map).
      // After enrich-contacts.ts runs this should rarely fire.
      const { data: msgRows } = await supabase
        .from('signals')
        .select('body')
        .eq('pid', pid)
        .eq('sender_wa_id', waId)
        .is('sender_name', null)
        .not('body', 'is', null)
        .order('sent_at', { ascending: false })
        .limit(30);

      const samples = (msgRows ?? []).map((m) => m.body as string).filter(Boolean);

      if (!project) {
        rows.push({ pid, sender_name: waId, sender_wa_id: waId, role: 'unknown', display_label: null, resolved_via: 'auto_llm', resolved_at: now });
        manualQueue.push({ pid, key: waId });
        passCount.unknown++;
        continue;
      }

      const p2 = await resolveViaHaiku(pid, waId, project, samples);
      if (p2 && p2.role !== 'unknown') {
        console.log(`  [haiku/${p2.confidence}]  "${waId}" → ${p2.role}  "${p2.display_label}"`);
        rows.push({ pid, sender_name: waId, sender_wa_id: waId, role: p2.role, display_label: p2.display_label, resolved_via: 'auto_llm', resolved_at: now });
        passCount.haiku++;
      } else {
        console.log(`  [unknown]   "${waId}" — needs manual review`);
        rows.push({ pid, sender_name: waId, sender_wa_id: waId, role: 'unknown', display_label: null, resolved_via: 'auto_llm', resolved_at: now });
        manualQueue.push({ pid, key: waId });
        passCount.unknown++;
      }
    }
  }

  // Write to DB
  if (rows.length > 0) {
    const { error } = await supabase
      .from('signal_senders')
      .upsert(rows, { onConflict: 'pid,sender_name', ignoreDuplicates: true });
    if (error) { console.error('Upsert error:', error); process.exit(1); }
  }

  console.log(`\n=== Done ===`);
  console.log(`  env/tl         : ${passCount.tl}`);
  console.log(`  auto_projects  : ${passCount.projects}`);
  console.log(`  wa_contact_map : ${passCount.contact_map}`);
  console.log(`  auto_llm       : ${passCount.haiku}`);
  console.log(`  unknown        : ${passCount.unknown}`);

  if (manualQueue.length > 0) {
    console.log(`\nManual review needed (${manualQueue.length}):`);
    for (const { pid, key } of manualQueue) {
      console.log(
        `  UPDATE public.signal_senders SET role='...', display_label='...' ` +
        `WHERE pid=${pid} AND sender_name='${key.replace(/'/g, "''")}';`,
      );
    }
  }

  const totalResolved = passCount.tl + passCount.projects + passCount.contact_map + passCount.haiku;
  await supabase.from('cron_runs').insert({
    tier: 'resolve_senders',
    started_at: new Date(resolveStart).toISOString(),
    finished_at: new Date().toISOString(),
    status: 'completed',
    rows_written: totalResolved,
  });
}

main().catch((err) => { console.error(err); process.exit(1); });
