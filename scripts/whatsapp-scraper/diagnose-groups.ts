import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';

// PIDs missing client or internal groups from the Phase 3 run
const MISSING_CLIENT = ['26903', '28166', '28698', '28625'];
const MISSING_INTERNAL = ['32245', '23671', '29568', '33797', '33673', '33565', '31574', '33313', '34002'];
const ALL_MISSING = [...new Set([...MISSING_CLIENT, ...MISSING_INTERNAL])];

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
  qrcode.generate(qr, { small: true });
});
wa.on('authenticated', () => console.log('Authenticated.\n'));
wa.on('auth_failure', (msg) => { console.error('Auth failure:', msg); process.exit(1); });

wa.on('ready', async () => {
  console.log('Logged in. Fetching chats...\n');
  await new Promise((r) => setTimeout(r, 5000));

  const chats = await wa.getChats();
  const groups = chats.filter((c) => c.isGroup);

  for (const pid of ALL_MISSING) {
    // Find every group whose name contains this PID as a standalone number
    const matches = groups.filter((g) => new RegExp(`(?<![0-9])${pid}(?![0-9])`).test(g.name));
    const missingWhat = [
      MISSING_CLIENT.includes(pid) ? 'client' : null,
      MISSING_INTERNAL.includes(pid) ? 'internal' : null,
    ].filter(Boolean).join(' + ');

    if (matches.length === 0) {
      console.log(`PID ${pid} [missing: ${missingWhat}] — NO groups found containing this PID`);
    } else {
      console.log(`PID ${pid} [missing: ${missingWhat}] — found ${matches.length} group(s):`);
      for (const g of matches) console.log(`  "${g.name}"`);
    }
    console.log();
  }

  await wa.destroy();
  process.exit(0);
});

console.log('Starting...');
wa.initialize();
