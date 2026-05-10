import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load env from parent project's .env.local
config({ path: resolve(process.cwd(), '../../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Client groups contain "PID : <number>" or "PID: <number>" anywhere in the title
const CLIENT_PATTERN = /\bPID\s*:\s*(\d{4,6})\b/i;
// Internal groups start with "<region> - <pid> - ..." (HP/RJ/Jaipur/Udaipur/Kerala/etc.)
const INTERNAL_PATTERN = /^[A-Za-z][A-Za-z\s]*\s*-\s*(\d{4,6})\b/;

const DEMO_PIDS = ['24292', '28172', '33798'];
const MESSAGE_LIMIT = 200;

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
) {
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
    return;
  }

  const { error } = await supabase
    .from('signals')
    .upsert(rows, { onConflict: 'wa_message_id', ignoreDuplicates: true });

  if (error) {
    console.error(`    ERROR: ${error.message}`);
  } else {
    console.log(`    Wrote ${rows.length} messages.`);
  }
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

  console.log('\nDemo PID coverage:');
  for (const pid of DEMO_PIDS) {
    const cg = clientGroups.find((g) => g.pid === pid);
    const ig = internalGroups.find((g) => g.pid === pid);
    console.log(
      `  PID ${pid}: client=${cg ? 'YES' : 'NO '}  internal=${ig ? 'YES' : 'NO '}`,
    );
    if (cg) console.log(`    -> ${cg.name}`);
    if (ig) console.log(`    -> ${ig.name}`);
  }

  console.log('\n--- Scraping messages for demo PIDs ---');
  for (const pid of DEMO_PIDS) {
    console.log(`\nPID ${pid}:`);
    const cg = clientGroups.find((g) => g.pid === pid);
    const ig = internalGroups.find((g) => g.pid === pid);

    if (cg) await scrapeAndStore(pid, 'client', cg.name, cg.chat);
    else console.log(`  No client group found — skipping.`);

    if (ig) await scrapeAndStore(pid, 'internal', ig.name, ig.chat);
    else console.log(`  No internal group found — skipping.`);
  }

  console.log('\nDone. Exiting.');
  await wa.destroy();
  process.exit(0);
});

console.log('Starting WhatsApp client (this will take ~10-20s on first run)...');
wa.initialize();
