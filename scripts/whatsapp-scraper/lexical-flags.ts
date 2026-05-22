// Phase 1 — Step 3: Deterministic lexical pre-pass for severity-1 signals
//
// Runs after each scrape. Scans signals (last 14 days by default) for severity-1
// lexical patterns and writes hits to the lexical_flags table. Bilingual:
// English + Hindi/Hinglish. Detected hits also appear in the sop_flags view
// so T1 sees them as deterministic inputs.
//
// Detectors:
//   WS14 — cancellation language (critical, client group)
//   WS15 — won't-pay / bulk payment (high, client group)
//   WS41 — self-sourcing intent (critical, client group)
//   WS42 — self-sourcing + relationship carve-out (trend_watch, client group)
//   WS43 — empaneled vendor (high, any group)
//   WS50 — CP/SP visible to client (critical, client group)
//
// Usage:
//   npx tsx lexical-flags.ts                       # all PIDs, last 14 days
//   npx tsx lexical-flags.ts --pid=28438           # one PID
//   npx tsx lexical-flags.ts --since=2026-05-01    # custom window

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '../../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const pidArg = args.find((a) => a.startsWith('--pid='))?.replace('--pid=', '');
const sinceArg = args.find((a) => a.startsWith('--since='))?.replace('--since=', '');

const sinceDate = sinceArg
  ? new Date(sinceArg + 'T00:00:00+05:30').toISOString()
  : new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

// ---------------------------------------------------------------------------
// Detector patterns
// ---------------------------------------------------------------------------

type Pattern = { re: RegExp; label: string };

// WS41/42 — self-sourcing intent (both orderings: verb...selfref + selfref...verb)
const SELF_SOURCING_EN: Pattern[] = [
  {
    re: /\b(?:book|arrang|handl|sort|figur|finaliz|tak[ei]\s*car)\w*[^.?!]{0,50}?\b(?:ourselves|myself|directly|on\s+our\s+own|by\s+ourselves)\b/i,
    label: 'verb...selfref',
  },
  {
    re: /\b(?:ourselves|myself|on\s+our\s+own|by\s+ourselves)\b[^.?!]{0,50}?\b(?:book|arrang|handl|sort|figur|finaliz|tak[ei]\s*car)\w*/i,
    label: 'selfref...verb',
  },
];

const SELF_SOURCING_HI: Pattern[] = [
  { re: /\bkhud\s+(?:kar|book|arrange|le|dekh|kara|karwa)\w*\s*(?:leng?e|lung?a|lo|denge?)?/i, label: 'khud kar lenge' },
  { re: /\bhum\s+(?:dekh|le|kar|book)\s+leng?e\b/i, label: 'hum le lenge' },
  { re: /\bapne\s+(?:aap|se)\s+(?:kar|book|arrange|le)\w*/i, label: 'apne aap karenge' },
  { re: /\bkhud\s+se\s+(?:kar|book|le|arrange)\w*/i, label: 'khud se karenge' },
];

// Relationship carve-out — if message contains family/relative term, WS41 → WS42
const RELATIONSHIP_TERMS: Pattern[] = [
  { re: /\b(?:cousin|uncle|aunty|aunt|family\s+friend|relative|brother-in-law|sister-in-law)\b/i, label: 'english relation' },
  { re: /\b(?:mama|chacha|chachi|bhua|mausi|mami|taya|tai|dada|dadi|nana|nani|jiju|saala|sasur|saas|jeth|devar|nanad)\b/i, label: 'hindi relation' },
  { re: /\bmy\s+(?:brother|sister|father|mother|dad|mom|son|daughter|nephew|niece|cousin)\b/i, label: 'immediate family' },
  { re: /\bfamily\s+(?:knows|hai|hain|wala|wali|owns|runs|business|friend)\b/i, label: 'family business' },
];

// WS50 — CP/SP commercial vocabulary in client group
const CP_SP_VOCAB: Pattern[] = [
  { re: /\bcost\s*price\b/i, label: 'cost price' },
  { re: /\bselling\s*price\b/i, label: 'selling price' },
  { re: /\b(?:CP|SP)\b\s*(?:[:=]|of\s|is\s|=>|\s+₹|\s+\d|\s+at\s+)/i, label: 'CP/SP literal' },
  { re: /\b(?:markup|margin|commission|profit)\b\s*(?:[:=]|of\s|is\s|=>|\s+₹|\s+\d|\s+at\s+)/i, label: 'markup with number' },
  { re: /\bvendor\s+rate\b/i, label: 'vendor rate' },
  { re: /\bhamara\s+(?:rate|profit|margin|cost)\b/i, label: 'hamara rate' },
];

// WS43 — empaneled vendor (any group)
const EMPANELED: Pattern[] = [
  { re: /\b(?:empaneled|empanelled)\b/i, label: 'empaneled' },
  { re: /\bpanel\s+vendor(?:s)?\b/i, label: 'panel vendor' },
  { re: /\bvenue(?:'s|s)?\s+(?:vendor|panel|preferred|tied[\s-]up)\b/i, label: "venue's vendor" },
  { re: /\bpanel\s+(?:ka|ki|ke|hai|mein|me)\b/i, label: 'panel ka' },
  { re: /\bhotel(?:'s|s)?\s+(?:vendor|panel|preferred)\b/i, label: "hotel's vendor" },
];

// WS14 — cancellation language.
// IMPORTANT: bare "cancellation" matches contract-clause discussion, which is
// healthy planning behavior, not a flag. Require first-person intent OR a
// strong cancellation verb. Exclude -ation noun suffix.
const CANCEL_EN: Pattern[] = [
  { re: /\b(?:we|i|i[’']?m|i\s+am|we[’']?re|we\s+are)\s+(?:want(?:ing)?\s+to\s+|going\s+to\s+|thinking\s+of\s+|planning\s+to\s+|need\s+to\s+|have\s+to\s+|may\s+|might\s+)?cancel(?!l?ation)\b/i, label: 'first-person cancel' },
  { re: /\bback(?:ing)?\s+out\s+(?:of|from)\b/i, label: 'back out of' },
  { re: /\bstop\s+the\s+(?:booking|wedding|event|whole\s+thing|planning)\b/i, label: 'stop the booking' },
  { re: /\bdo\s+not\s+want\s+to\s+(?:go\s+ahead|proceed|continue|move\s+forward)\b/i, label: 'do not want to proceed' },
  { re: /\bwithdraw(?:ing)?\s+from\s+(?:the\s+)?(?:booking|contract|deal|wedding|planning|event)\b/i, label: 'withdraw from' },
  { re: /\b(?:asking\s+for|want|need|requesting)\s+(?:a\s+|the\s+)?(?:full\s+)?refund\b/i, label: 'refund request' },
];

const CANCEL_HI: Pattern[] = [
  { re: /\bcancel\s+(?:kar(?:te?\s+hain|na\s+hai|na\s+chahte|wa\s+do)|kara\s+do)/i, label: 'cancel karna hai' },
  { re: /\bnahi(?:n)?\s+karen?ge?\s+(?:shaadi|wedding|event|booking|book)/i, label: 'nahin karenge shaadi' },
  { re: /\bbooking\s+(?:cancel|band)\s+kar/i, label: 'booking cancel kar' },
  { re: /\bband\s+karte?\s+(?:hain|do)\b/i, label: 'band karte hain' },
];

// WS15 — won't-pay / bulk payment
const WONT_PAY_EN: Pattern[] = [
  { re: /\bwon[’']?t\s+pay\b/i, label: "won't pay" },
  { re: /\bwill\s+not\s+pay\b/i, label: 'will not pay' },
  { re: /\bwithhold(?:ing)?\s+payment\b/i, label: 'withhold payment' },
  { re: /\bcan(?:not|[’']?t)\s+pay\s+now\b/i, label: 'cannot pay now' },
  { re: /\bbulk\s+payment\b/i, label: 'bulk payment' },
  { re: /\bno\s+install?ments?\b/i, label: 'no installments' },
  { re: /\bone\s+(?:shot|time|go)\s+(?:only|payment)\b/i, label: 'one shot payment' },
  { re: /\bpay\s+(?:in\s+)?(?:full|lump\s*sum)\s+(?:later|closer|near)/i, label: 'pay in full later' },
];

const WONT_PAY_HI: Pattern[] = [
  { re: /\bek\s+(?:saath|sath|baar|baari)\s+(?:denge?|de\s+denge?|paise\s+denge?)\b/i, label: 'ek saath denge' },
  { re: /\b(?:bulk|saath|sath)\s+(?:mein|me)\s+(?:denge?|payment)\b/i, label: 'bulk mein' },
  { re: /\babhi\s+nahi(?:n)?\s+denge?\b/i, label: 'abhi nahin denge' },
  { re: /\binstall?ment(?:s)?\s+nahi(?:n)?\b/i, label: 'installment nahin' },
  { re: /\bpaise\s+baad\s+(?:mein|me)\s+denge?\b/i, label: 'paise baad mein' },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Signal = {
  id: string;
  pid: number;
  body: string;
  sent_at: string;
  chat_type: string | null;
  sender_name: string | null;
  sender_wa_id: string | null;
};

type DetectedFlag = {
  signal_id: 'WS14' | 'WS15' | 'WS41' | 'WS42' | 'WS43' | 'WS50';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'trend_watch';
  source_group: 'internal' | 'client' | 'venue';
  matched_text: string;
  matched_pattern: string;
};

// ---------------------------------------------------------------------------
// Detector
// ---------------------------------------------------------------------------

function firstMatch(body: string, patterns: Pattern[]): { match: string; pattern: string } | null {
  for (const p of patterns) {
    const m = body.match(p.re);
    if (m) {
      return { match: m[0].slice(0, 200), pattern: p.label };
    }
  }
  return null;
}

function detectFlags(sig: Signal): DetectedFlag[] {
  const body = sig.body ?? '';
  const out: DetectedFlag[] = [];

  const sourceGroup: DetectedFlag['source_group'] =
    sig.chat_type === 'client' ? 'client' : 'internal';

  // WS14 — cancellation (client group only)
  if (sourceGroup === 'client') {
    const m = firstMatch(body, [...CANCEL_EN, ...CANCEL_HI]);
    if (m) {
      out.push({
        signal_id: 'WS14',
        severity: 'critical',
        source_group: sourceGroup,
        matched_text: m.match,
        matched_pattern: m.pattern,
      });
    }
  }

  // WS15 — won't-pay (client group only)
  if (sourceGroup === 'client') {
    const m = firstMatch(body, [...WONT_PAY_EN, ...WONT_PAY_HI]);
    if (m) {
      out.push({
        signal_id: 'WS15',
        severity: 'high',
        source_group: sourceGroup,
        matched_text: m.match,
        matched_pattern: m.pattern,
      });
    }
  }

  // WS41 / WS42 — self-sourcing + relationship carve-out (client group only)
  if (sourceGroup === 'client') {
    const m = firstMatch(body, [...SELF_SOURCING_EN, ...SELF_SOURCING_HI]);
    if (m) {
      const hasRelationship = firstMatch(body, RELATIONSHIP_TERMS) !== null;
      out.push({
        signal_id: hasRelationship ? 'WS42' : 'WS41',
        severity: hasRelationship ? 'trend_watch' : 'critical',
        source_group: sourceGroup,
        matched_text: m.match,
        matched_pattern: m.pattern,
      });
    }
  }

  // WS43 — empaneled vendor (any group)
  {
    const m = firstMatch(body, EMPANELED);
    if (m) {
      out.push({
        signal_id: 'WS43',
        severity: 'high',
        source_group: sourceGroup,
        matched_text: m.match,
        matched_pattern: m.pattern,
      });
    }
  }

  // WS50 — CP/SP in client group (critical trust risk)
  if (sourceGroup === 'client') {
    const m = firstMatch(body, CP_SP_VOCAB);
    if (m) {
      out.push({
        signal_id: 'WS50',
        severity: 'critical',
        source_group: sourceGroup,
        matched_text: m.match,
        matched_pattern: m.pattern,
      });
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function loadAllSignals(): Promise<Signal[]> {
  const PAGE_SIZE = 1000;
  const pidFilter = pidArg ? parseInt(pidArg, 10) : null;
  const out: Signal[] = [];

  for (let from = 0; from < 200_000; from += PAGE_SIZE) {
    const base = supabase
      .from('signals')
      .select('id, pid, body, sent_at, chat_type, sender_name, sender_wa_id')
      .gte('sent_at', sinceDate)
      .not('body', 'is', null)
      .order('sent_at', { ascending: true });
    const filtered = pidFilter !== null ? base.eq('pid', pidFilter) : base;

    const { data, error } = await filtered.range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error('Signal query failed:', error.message);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    out.push(...(data as Signal[]));
    if (data.length < PAGE_SIZE) break;
  }
  return out;
}

async function main() {
  console.log(`Lexical pre-pass — scanning signals since ${sinceDate}`);
  if (pidArg) console.log(`  (PID filter: ${pidArg})`);

  const signals = await loadAllSignals();

  if (signals.length === 0) {
    console.log('No signals to scan.');
    return;
  }

  console.log(`\nScanning ${signals.length} signal(s)...\n`);

  let processed = 0;
  let written = 0;
  const tallyBySignal: Record<string, number> = {};

  for (const raw of signals) {
    processed++;
    if (!raw.body) continue;

    const flags = detectFlags(raw);
    if (flags.length === 0) continue;

    for (const f of flags) {
      const { error: upsertErr } = await supabase
        .from('lexical_flags')
        .upsert(
          {
            pid: raw.pid,
            signal_id: f.signal_id,
            severity: f.severity,
            source_group: f.source_group,
            matched_text: f.matched_text,
            matched_pattern: f.matched_pattern,
            message_id: raw.id,
            message_sent_at: raw.sent_at,
            speaker_name: raw.sender_name,
            speaker_wa_id: raw.sender_wa_id,
          },
          {
            onConflict: 'pid,signal_id,message_id',
            ignoreDuplicates: true,
          },
        );

      if (upsertErr) {
        if (!upsertErr.message.toLowerCase().includes('duplicate')) {
          console.error(`  PID ${raw.pid} ${f.signal_id}: ${upsertErr.message}`);
        }
        continue;
      }
      written++;
      tallyBySignal[f.signal_id] = (tallyBySignal[f.signal_id] ?? 0) + 1;
    }
  }

  console.log(`\nProcessed ${processed} signals`);
  console.log(`Wrote ${written} new lexical flag(s)`);
  if (Object.keys(tallyBySignal).length) {
    for (const [sid, count] of Object.entries(tallyBySignal).sort()) {
      console.log(`  ${sid}: ${count}`);
    }
  }

  await supabase.from('cron_runs').insert({
    tier: 'lexical',
    started_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
    status: 'completed',
    rows_written: written,
  });
}

main().catch((err) => {
  console.error('FATAL:', err instanceof Error ? err.message : err);
  process.exit(1);
});
