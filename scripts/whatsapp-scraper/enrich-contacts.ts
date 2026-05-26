// One-shot enrichment: for every distinct sender_wa_id in signals,
// ask WhatsApp Web for the contact's saved name / pushname / phone
// and persist into wa_contact_map.
//
// Run after scrape, with WhatsApp Web session alive in ./.wwebjs_auth.
// Re-runs are idempotent — same wa_id upserts with updated enriched_at.
//
//   npx tsx enrich-contacts.ts            # all distinct wa_ids in signals
//   npx tsx enrich-contacts.ts --refresh  # re-fetch even already-enriched rows
//   npx tsx enrich-contacts.ts <wa_id...> # only the specified ids

import { Client, LocalAuth } from 'whatsapp-web.js';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '../../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const CHROME_PATH =
  process.env.CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const args = process.argv.slice(2);
const REFRESH = args.includes('--refresh');
const EXPLICIT_IDS = args.filter((a) => !a.startsWith('--') && a.length > 0);

async function listTargetWaIds(): Promise<string[]> {
  if (EXPLICIT_IDS.length > 0) return EXPLICIT_IDS;

  // Page through signals, collect distinct sender_wa_id
  const seen = new Set<string>();
  let from = 0;
  const page = 1000;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data: rows } = await supabase
      .from('signals')
      .select('sender_wa_id')
      .not('sender_wa_id', 'is', null)
      .range(from, from + page - 1);
    if (!rows || rows.length === 0) break;
    for (const r of rows) {
      if (r.sender_wa_id) seen.add(r.sender_wa_id as string);
    }
    if (rows.length < page) break;
    from += page;
  }
  return Array.from(seen);
}

async function loadAlreadyEnriched(): Promise<Set<string>> {
  const seen = new Set<string>();
  let from = 0;
  const page = 1000;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data } = await supabase
      .from('wa_contact_map')
      .select('wa_id')
      .range(from, from + page - 1);
    if (!data || data.length === 0) break;
    for (const r of data) seen.add(r.wa_id as string);
    if (data.length < page) break;
    from += page;
  }
  return seen;
}

async function main() {
  const enrichStart = Date.now();
  const allIds = await listTargetWaIds();
  console.log(`Distinct wa_ids in signals: ${allIds.length}`);

  const already = REFRESH ? new Set<string>() : await loadAlreadyEnriched();
  const todo = allIds.filter((id) => !already.has(id));
  console.log(`Already enriched: ${already.size}. To process: ${todo.length}.`);

  if (todo.length === 0) {
    console.log('Nothing to do. Pass --refresh to re-fetch.');
    return;
  }

  const wa = new Client({
    authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
    puppeteer: {
      headless: true,
      executablePath: CHROME_PATH,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      protocolTimeout: 180_000,
    },
  });

  await new Promise<void>((res, rej) => {
    wa.once('ready', () => res());
    wa.once('auth_failure', (m) => rej(new Error(`Auth failure: ${m}`)));
    wa.initialize();
  });
  console.log('WA Web ready.\n');

  let ok = 0;
  let fail = 0;
  const rows: Array<{
    wa_id: string;
    saved_name: string | null;
    phone: string | null;
    pushname: string | null;
    is_my_contact: boolean | null;
    is_business: boolean | null;
    is_blocked: boolean | null;
    source: string;
  }> = [];

  for (let i = 0; i < todo.length; i++) {
    const waId = todo[i];
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c: any = await wa.getContactById(waId);
      const saved_name: string | null =
        c?.name && typeof c.name === 'string' ? c.name : null;
      const pushname: string | null =
        c?.pushname && typeof c.pushname === 'string' ? c.pushname : null;
      const phone: string | null = c?.number && typeof c.number === 'string' ? c.number : null;

      rows.push({
        wa_id: waId,
        saved_name,
        phone,
        pushname,
        is_my_contact: typeof c?.isMyContact === 'boolean' ? c.isMyContact : null,
        is_business: typeof c?.isBusiness === 'boolean' ? c.isBusiness : null,
        is_blocked: typeof c?.isBlocked === 'boolean' ? c.isBlocked : null,
        source: 'wa_web_enrich',
      });

      ok++;
      const label = saved_name ?? pushname ?? '(no name)';
      console.log(
        `  [${i + 1}/${todo.length}] ${waId.padEnd(28)} -> saved="${saved_name ?? ''}"  push="${
          pushname ?? ''
        }"  phone="${phone ?? ''}"  myContact=${c?.isMyContact ?? '?'}  -> ${label}`,
      );
    } catch (err: unknown) {
      fail++;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`  [${i + 1}/${todo.length}] ${waId} -> FAIL: ${msg}`);
    }

    // Light pacing — WA Web rate-limits silently if hammered
    if ((i + 1) % 25 === 0) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  console.log(`\nLookups done. ok=${ok} fail=${fail}. Writing to wa_contact_map...`);

  // Upsert in batches of 100
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const { error } = await supabase
      .from('wa_contact_map')
      .upsert(batch, { onConflict: 'wa_id' });
    if (error) {
      console.error('  upsert error:', error);
      throw error;
    }
  }

  console.log(`Wrote ${rows.length} rows.`);

  // Quick summary
  const haveSaved = rows.filter((r) => r.saved_name).length;
  const havePush = rows.filter((r) => r.pushname && !r.saved_name).length;
  const havePhone = rows.filter((r) => r.phone).length;
  const blank = rows.filter((r) => !r.saved_name && !r.pushname && !r.phone).length;
  console.log(`\nSummary:`);
  console.log(`  saved_name populated:           ${haveSaved}`);
  console.log(`  pushname only (no saved_name):  ${havePush}`);
  console.log(`  phone populated:                ${havePhone}`);
  console.log(`  nothing at all:                 ${blank}`);

  await supabase.from('cron_runs').insert({
    tier: 'enrich_contacts',
    started_at: new Date(enrichStart).toISOString(),
    finished_at: new Date().toISOString(),
    status: 'completed',
    rows_written: rows.length,
  });

  await wa.destroy();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('FATAL:', e);
    process.exit(1);
  });
