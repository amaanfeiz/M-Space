import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';

// Client groups always contain "PID: <number>" anywhere in the title
const CLIENT_PATTERN = /\bPID\s*:\s*(\d{4,6})\b/i;
// Internal groups (95%) start with "<region> - <pid> - ..." where region is HP/RJ/Jaipur/Udaipur/Kerala/etc.
const INTERNAL_PATTERN = /^[A-Za-z][A-Za-z\s]*\s*-\s*(\d{4,6})\b/;

const DEMO_PIDS = ['24292', '28172', '33798'];

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

wa.on('ready', async () => {
  console.log('Logged in. Waiting 5s for chat sync to settle...');
  await new Promise((r) => setTimeout(r, 5000));
  console.log('Fetching chats (this can take 30-90s on first run)...\n');

  const chats = await wa.getChats();
  const groupChats = chats.filter((c) => c.isGroup);

  const clientGroups: Array<{ name: string; pid: string }> = [];
  const internalGroups: Array<{ name: string; pid: string }> = [];

  for (const chat of groupChats) {
    const clientMatch = chat.name.match(CLIENT_PATTERN);
    const internalMatch = chat.name.match(INTERNAL_PATTERN);

    if (internalMatch) {
      internalGroups.push({ name: chat.name, pid: internalMatch[1] });
    } else if (clientMatch) {
      clientGroups.push({ name: chat.name, pid: clientMatch[1] });
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

  if (clientGroups.length > 0 || internalGroups.length > 0) {
    console.log('\nFirst 3 client groups:');
    clientGroups.slice(0, 3).forEach((g) => console.log(`  PID ${g.pid}: ${g.name}`));
    console.log('\nFirst 3 internal groups:');
    internalGroups.slice(0, 3).forEach((g) => console.log(`  PID ${g.pid}: ${g.name}`));
  }

  await wa.destroy();
  process.exit(0);
});

console.log('Starting WhatsApp client (this will take ~10-20s on first run)...');
wa.initialize();
