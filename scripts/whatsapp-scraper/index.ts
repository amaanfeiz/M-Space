import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';
import { ALL_AMAAN_PIDS_STR } from './all-pids';

// Load env from parent project's .env.local
config({ path: resolve(process.cwd(), '../../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Client groups contain "PID : <number>", "PID: <number>", or "PID <number>" anywhere in the title
const CLIENT_PATTERN = /\bPID\s*:?\s*(\d{4,6})\b/i;
// Internal groups start with a region/location prefix then a PID number.
// Handles: "HP - 24292", "UK - Rishikesh - 23671" (multi-part), "Udaipur _ 29568" (underscore),
// "RAJ/ Goa - 33797" (slash), "UK PID 31574" (PID keyword without colon),
// "RJ_PID-32245_..." (old underscore format — \b fails here since _ is \w, use (?!\d) instead).
const INTERNAL_PATTERN = /^[A-Za-z][A-Za-z\s/\-_]*?(\d{4,6})(?!\d)/;

// Shared source of truth — see ./all-pids.ts. Update PIDs there.
const ALL_AMAAN_PIDS = [...ALL_AMAAN_PIDS_STR];

// CLI: pass specific PIDs as args (e.g. npx tsx index.ts 28698 21491), or run all if none given
const cliPids = process.argv.slice(2).filter((a) => /^\d+$/.test(a));
const TARGET_PIDS = cliPids.length > 0 ? cliPids : ALL_AMAAN_PIDS;

const MESSAGE_LIMIT = parseInt(process.env.MESSAGE_LIMIT ?? '2000', 10);

const CHROME_PATH =
  process.env.CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const wa = new Client({
  authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
  puppeteer: {
    headless: true,
    executablePath: CHROME_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    protocolTimeout: 180_000,
  },
});

wa.on('qr', (qr) => {
  console.log('\n=== Scan this QR code with WhatsApp on your phone ===');
  console.log('(WhatsApp -> Settings -> Linked Devices -> Link a Device)\n');
  qrcode.generate(qr, { small: true });
});

wa.on('authenticated', () => {
  console.log('Authenticated. Session saved to ./.wwebjs_auth\n');
});

wa.on('auth_failure', (msg) => {
  console.error('Auth failure:', msg);
  process.exit(1);
});

async function scrapeAndStore(
  pid: string,
  groupType: 'client' | 'internal',
  groupName: string,
  chat: Awaited<ReturnType<typeof wa.getChatById>>,
): Promise<{ attempted: number; errored: boolean }> {
  console.log(`  Fetching ${MESSAGE_LIMIT} messages from: ${groupName}`);
  const messages = await chat.fetchMessages({ limit: MESSAGE_LIMIT });

  const rows = messages
    .filter((m) => m.type === 'chat' || m.hasMedia)
    .map((m) => ({
      pid: parseInt(pid, 10),
      source_type: 'whatsapp' as const,
      source: 'scraper' as const,
      chat_type: groupType,
      group_name: groupName,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      wa_message_id: (m.id as any)._serialized as string,
      sender_wa_id: m.author ?? m.from,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sender_name: (m as any)._data?.notifyName ?? null,
      body: m.body || null,
      message_type: m.type,
      has_media: m.hasMedia,
      sent_at: new Date(m.timestamp * 1000).toISOString(),
    }));

  if (rows.length === 0) {
    console.log(`    No messages to write.`);
    return { attempted: 0, errored: false };
  }

  const { error } = await supabase
    .from('signals')
    .upsert(rows, { onConflict: 'wa_message_id', ignoreDuplicates: true });

  if (error) {
    console.error(`    ERROR: ${error.message}`);
    return { attempted: rows.length, errored: true };
  }
  console.log(`    Wrote ${rows.length} messages.`);
  return { attempted: rows.length, errored: false };
}

wa.on('ready', async () => {
  console.log('Logged in. Waiting 5s for chat sync to settle...');
  await new Promise((r) => setTimeout(r, 5000));
  console.log('Fetching chats (this can take 30-90s on first run)...\n');

  const chats = await wa.getChats();
  const groupChats = chats.filter((c) => c.isGroup);

  const clientGroups: Array<{ name: string; pid: string; chat: typeof groupChats[0] }> = [];
  const internalGroups: Array<{ name: string; pid: string; chat: typeof groupChats[0] }> = [];

  for (const chat of groupChats) {
    const clientMatch = chat.name.match(CLIENT_PATTERN);
    const internalMatch = chat.name.match(INTERNAL_PATTERN);

    if (internalMatch) {
      internalGroups.push({ name: chat.name, pid: internalMatch[1], chat });
    } else if (clientMatch) {
      clientGroups.push({ name: chat.name, pid: clientMatch[1], chat });
    }
  }

  console.log(`Total chats:        ${chats.length}`);
  console.log(`Total groups:       ${groupChats.length}`);
  console.log(`Client PID groups:  ${clientGroups.length}`);
  console.log(`Internal groups:    ${internalGroups.length}`);
  console.log(`Target PIDs (${TARGET_PIDS.length}): ${TARGET_PIDS.join(', ')}`);

  console.log('\nCoverage check:');
  const neitherFound: string[] = [];
  for (const pid of TARGET_PIDS) {
    const cg = clientGroups.find((g) => g.pid === pid);
    const ig = internalGroups.find((g) => g.pid === pid);
    if (!cg && !ig) {
      neitherFound.push(pid);
      console.log(`  PID ${pid}: NO GROUPS FOUND`);
    } else {
      console.log(`  PID ${pid}: client=${cg ? 'YES' : 'NO '}  internal=${ig ? 'YES' : 'NO '}`);
      if (cg) console.log(`    -> ${cg.name}`);
      if (ig) console.log(`    -> ${ig.name}`);
    }
  }

  if (neitherFound.length > 0) {
    console.log(`\nCouldn't find any group for ${neitherFound.length} PID(s): ${neitherFound.join(', ')}`);
  }

  console.log('\n--- Scraping messages ---');
  const perPid = new Map<string, { client: number; internal: number; errored: boolean }>();
  for (const pid of TARGET_PIDS) {
    if (neitherFound.includes(pid)) continue;

    console.log(`\nPID ${pid}:`);
    const cg = clientGroups.find((g) => g.pid === pid);
    const ig = internalGroups.find((g) => g.pid === pid);

    const tally = { client: 0, internal: 0, errored: false };
    if (cg) {
      const r = await scrapeAndStore(pid, 'client', cg.name, cg.chat);
      tally.client = r.attempted;
      if (r.errored) tally.errored = true;
    } else console.log(`  No client group found.`);

    if (ig) {
      const r = await scrapeAndStore(pid, 'internal', ig.name, ig.chat);
      tally.internal = r.attempted;
      if (r.errored) tally.errored = true;
    } else console.log(`  No internal group found.`);

    perPid.set(pid, tally);
  }

  // --- Run summary ---
  const totalRows = [...perPid.values()].reduce((s, t) => s + t.client + t.internal, 0);
  const scrapedPids = [...perPid.entries()].filter(([, t]) => t.client + t.internal > 0).length;
  const erroredPids = [...perPid.entries()].filter(([, t]) => t.errored).map(([pid]) => pid);
  const zeroPids = [...perPid.entries()]
    .filter(([, t]) => t.client + t.internal === 0)
    .map(([pid]) => pid);

  console.log(`\n=== Run summary ===`);
  console.log(`Target PIDs:           ${TARGET_PIDS.length}`);
  console.log(`Groups found:          client=${clientGroups.length}  internal=${internalGroups.length}`);
  console.log(`PIDs with messages:    ${scrapedPids}/${TARGET_PIDS.length}`);
  console.log(`Total rows attempted:  ${totalRows} (duplicates collapsed by ON CONFLICT)`);
  if (neitherFound.length > 0) {
    console.log(`No matching groups:    ${neitherFound.join(', ')}`);
  }
  if (zeroPids.length > 0) {
    console.log(`Had group but 0 msgs:  ${zeroPids.join(', ')}`);
  }
  if (erroredPids.length > 0) {
    console.log(`DB write errored:      ${erroredPids.join(', ')}`);
  }
  if (totalRows === 0 && (clientGroups.length > 0 || internalGroups.length > 0)) {
    console.log(`\nWARNING: groups found but zero messages scraped.`);
    console.log(`  WhatsApp Web may not have synced. Try: close Chrome, run again.`);
    console.log(`  If session expired (14d inactive), QR rescan will be requested.`);
  }

  console.log('\nDone. Exiting.');
  await wa.destroy();
  process.exit(0);
});

console.log('Starting WhatsApp client (this will take ~10-20s on first run)...');
wa.initialize();
