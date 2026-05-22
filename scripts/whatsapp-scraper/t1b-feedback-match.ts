// T1b — Implicit feedback matcher
//
// Runs after every T1 brief generation. Does two things per run:
//
//   1. CREATE STUBS — for every brief generated today, insert a row in
//      clarification_evaluations with actual_sent=null. Records what was
//      suggested so we can compare later.
//
//   2. FILL PENDING — for any stub from the last 5 days where actual_sent
//      is still null, look for messages Amaan actually sent to the internal
//      group in the 96-hour window after that brief. If found, record the
//      match and compute a diff summary.
//
// v1 is deterministic-only (no Sonnet escalation). Sonnet disambiguation
// comes in Phase 7.5 once we have enough data to know which cases are hard.
//
// Usage:
//   npx tsx t1b-feedback-match.ts                    # today's date
//   npx tsx t1b-feedback-match.ts --date=2026-05-20  # specific date

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '../../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const args = process.argv.slice(2);
const dateArg = args.find((a) => a.startsWith('--date='))?.replace('--date=', '');
const TODAY = dateArg ?? new Date().toISOString().slice(0, 10);

console.log(`T1b implicit feedback matcher — brief_date: ${TODAY}\n`);

// =====================================================================
// Helpers
// =====================================================================

function wordOverlapPct(a: string, b: string): number {
  if (!a || !b) return 0;
  const wordsA = new Set(a.toLowerCase().match(/\w{4,}/g) ?? []);
  const wordsB = new Set(b.toLowerCase().match(/\w{4,}/g) ?? []);
  if (wordsA.size === 0) return 0;
  let overlap = 0;
  for (const w of wordsA) if (wordsB.has(w)) overlap++;
  return Math.round((overlap / wordsA.size) * 100);
}

function diffSummary(suggested: string, actual: string): string {
  const pctOverlap = wordOverlapPct(suggested, actual);
  const lenDiff = actual.length - suggested.length;
  const lenLabel =
    Math.abs(lenDiff) < 50
      ? 'similar length'
      : lenDiff < 0
        ? `shorter by ${Math.abs(lenDiff)} chars`
        : `longer by ${lenDiff} chars`;
  return `${lenLabel} · ${pctOverlap}% keyword overlap`;
}

function pickBestCandidate(
  suggested: string,
  candidates: Array<{ body: string; sent_at: string; signal_id: string }>,
): (typeof candidates)[0] {
  // Return the candidate with highest word overlap; tie-break by length (longer wins)
  return candidates.reduce((best, c) => {
    const bScore = wordOverlapPct(suggested, best.body);
    const cScore = wordOverlapPct(suggested, c.body);
    if (cScore > bScore) return c;
    if (cScore === bScore && c.body.length > best.body.length) return c;
    return best;
  });
}

// =====================================================================
// Step 1 — create stubs for today's briefs
// =====================================================================

async function createStubs(): Promise<number> {
  // Pull today's briefs
  const { data: briefs, error } = await supabase
    .from('briefs')
    .select('pid, brief_json')
    .eq('brief_date', TODAY);

  if (error) throw new Error(`briefs query: ${error.message}`);
  if (!briefs || briefs.length === 0) {
    console.log('  No briefs for today — skipping stub creation.');
    return 0;
  }

  let created = 0;
  for (const brief of briefs) {
    const suggested: string = brief.brief_json?.open_questions?.clarification_message ?? '';
    if (!suggested) continue; // no suggestion → nothing to track

    const { error: upsertErr } = await supabase
      .from('clarification_evaluations')
      .upsert(
        {
          pid: brief.pid,
          brief_date: TODAY,
          suggested_text: suggested,
          actual_sent: null,
          match_method: 'none',
          match_confidence: 'none',
        },
        { onConflict: 'pid,brief_date', ignoreDuplicates: true }, // don't overwrite a filled row
      );

    if (upsertErr) {
      console.error(`  PID ${brief.pid} stub error: ${upsertErr.message}`);
    } else {
      created++;
    }
  }

  console.log(`  Created ${created} stubs for ${TODAY}.`);
  return created;
}

// =====================================================================
// Step 2 — fill pending stubs from the last 5 days
// =====================================================================

async function fillPending(): Promise<number> {
  // Find stubs where actual_sent is still null and brief_date <= yesterday
  const yesterday = new Date(TODAY);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const fiveDaysAgo = new Date(TODAY);
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
  const fiveDaysAgoStr = fiveDaysAgo.toISOString().slice(0, 10);

  const { data: stubs, error: stubsErr } = await supabase
    .from('clarification_evaluations')
    .select('id, pid, brief_date, suggested_text')
    .is('actual_sent', null)
    .gte('brief_date', fiveDaysAgoStr)
    .lte('brief_date', yesterdayStr);

  if (stubsErr) throw new Error(`stubs query: ${stubsErr.message}`);
  if (!stubs || stubs.length === 0) {
    console.log('  No pending stubs to fill.');
    return 0;
  }

  console.log(`  ${stubs.length} pending stub(s) to attempt matching...`);
  let filled = 0;

  for (const stub of stubs) {
    // Find team_lead sender_name(s) for this PID
    const { data: senders } = await supabase
      .from('signal_senders')
      .select('sender_name')
      .eq('pid', stub.pid)
      .eq('role', 'team_lead');

    const tlNames = (senders ?? []).map((s) => s.sender_name).filter(Boolean);

    // Also match by wa_id — sender_name is null for saved contacts in internal groups
    // (whatsapp-web.js notifyName is empty for phonebook contacts)
    const tlWaId = process.env.TL_WA_ID ?? null;

    if (tlNames.length === 0 && !tlWaId) {
      console.log(`  PID ${stub.pid} [${stub.brief_date}]: no team_lead sender resolved — skipping.`);
      continue;
    }

    // Window: brief_date to brief_date + 96 hours
    const windowStart = new Date(stub.brief_date + 'T00:00:00+05:30').toISOString();
    const windowEnd = new Date(
      new Date(stub.brief_date + 'T00:00:00+05:30').getTime() + 96 * 60 * 60 * 1000,
    ).toISOString();

    // Build query — match by sender_name OR sender_wa_id
    let query = supabase
      .from('signals')
      .select('id, body, sent_at')
      .eq('pid', stub.pid)
      .eq('chat_type', 'internal')
      .gte('sent_at', windowStart)
      .lte('sent_at', windowEnd)
      .not('body', 'is', null)
      .gt('body', '');

    if (tlNames.length > 0 && tlWaId) {
      query = query.or(`sender_name.in.(${tlNames.map(n => `"${n}"`).join(',')}),sender_wa_id.eq.${tlWaId}`);
    } else if (tlWaId) {
      query = query.eq('sender_wa_id', tlWaId);
    } else {
      query = query.in('sender_name', tlNames);
    }

    const { data: signals } = await query;

    const candidates = (signals ?? [])
      .filter((s) => (s.body?.length ?? 0) > 80) // must be substantive, not a quick ack
      .map((s) => ({ body: s.body as string, sent_at: s.sent_at, signal_id: s.id as string }));

    if (candidates.length === 0) {
      console.log(`  PID ${stub.pid} [${stub.brief_date}]: no TL messages in window.`);
      continue;
    }

    const best = candidates.length === 1 ? candidates[0] : pickBestCandidate(stub.suggested_text, candidates);
    const confidence = candidates.length === 1 ? 'high' : 'medium';

    const summary = diffSummary(stub.suggested_text, best.body);
    console.log(`  PID ${stub.pid} [${stub.brief_date}]: matched (${confidence}) — ${summary}`);

    const { error: updateErr } = await supabase
      .from('clarification_evaluations')
      .update({
        actual_sent: best.body,
        matched_signal_id: best.signal_id,
        match_method: 'deterministic',
        match_confidence: confidence,
        match_window_hours: 96,
        diff_summary: summary,
        matched_at: new Date().toISOString(),
      })
      .eq('id', stub.id);

    if (updateErr) {
      console.error(`  PID ${stub.pid} update error: ${updateErr.message}`);
    } else {
      filled++;
    }
  }

  console.log(`  Filled ${filled}/${stubs.length} pending stubs.`);
  return filled;
}

// =====================================================================
// Main
// =====================================================================

async function main() {
  console.log('Step 1 — creating stubs for today\'s briefs...');
  const created = await createStubs();

  console.log('\nStep 2 — filling pending stubs from last 5 days...');
  const filled = await fillPending();

  // Log to cron_runs
  await supabase.from('cron_runs').insert({
    tier: 't1b',
    started_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
    status: 'completed',
    rows_written: created + filled,
  });

  console.log(`\n=== Done === stubs created: ${created} · stubs filled: ${filled}`);
}

main().catch((err) => {
  console.error('FATAL:', err instanceof Error ? err.message : err);
  process.exit(1);
});
