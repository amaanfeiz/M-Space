// Ingest WhatsApp .txt exports from Obsidian/Meragi-Intel/WA Ex/ into public.signals.
// Uses whatsapp-chat-parser (npm) — don't roll your own date/sender parser.
//
// Idempotent: relies on the signals_dedupe_idx unique index on
// (pid, sent_at_minute, sender_name, body_hash) — re-running won't duplicate.
//
// Run: npx tsx ingest-exports.ts

import { promises as fs } from 'node:fs';
import { resolve, basename } from 'node:path';
import { parseString, type Message } from 'whatsapp-chat-parser';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: resolve(process.cwd(), '../../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const EXPORTS_DIR = 'C:\\Users\\Amaan\\Obsidian\\Meragi-Intel\\WA Ex';

const REGION_CODES = ['HP', 'RJ', 'Jaipur', 'Udaipur', 'Kerala', 'UK', 'DEL', 'GOA'];
// Match a region prefix at the start of a chat name or filename, optionally with
// extra qualifier words between the region and the PID (e.g.
// "UK - Rishikesh - 23671 - ..."). The PID itself isn't required for this test —
// presence of the region prefix is enough to call it an internal HP-team group.
const REGION_PATTERN = new RegExp(
  `^(${REGION_CODES.join('|')})\\b[\\s_]*[-_]`,
  'i',
);
const REGION_PID_PATTERN = new RegExp(
  `^(?:${REGION_CODES.join('|')})[\\s_]*[-_][\\s_]*_*(\\d{4,6})`,
  'i',
);

function extractPid(filename: string): number | null {
  // "PID 24292" / "PID:24292" / "PID__24292" / "PID-24292" — client groups
  let m = filename.match(/PID[\s_:_-]*[_-]*(\d{4,6})/i);
  if (m) return parseInt(m[1], 10);
  // <Region>_-_<digits>_- — internal groups (clean form)
  m = filename.match(REGION_PID_PATTERN);
  if (m) return parseInt(m[1], 10);
  // Region-prefixed but with extra words before the PID
  // (e.g. "UK_-_Rishikesh_-_23671_-_..."): grab the first 4-6 digit run.
  if (REGION_PATTERN.test(filename) || /^(HP|RJ|Jaipur|Udaipur|Kerala|UK|DEL|GOA)/i.test(filename)) {
    m = filename.match(/(\d{4,6})/);
    if (m) return parseInt(m[1], 10);
  }
  return null;
}

function classifyChatType(chatName: string, filename: string): 'client' | 'internal' {
  // "Cx" suffix in chat name = client-facing group even if filename starts with region
  if (/\bCx\b/.test(chatName)) return 'client';
  // Region prefix in chat name = internal HP/team group
  if (REGION_PATTERN.test(chatName)) return 'internal';
  // Pipe-delimited PID + "Meragi Celebrations" = client
  if (/\|\s*PID/i.test(chatName) || /\bMeragi Celebrations\b/i.test(chatName)) {
    return 'client';
  }
  // Fallback to filename
  if (/_Cx[._]/i.test(filename)) return 'client';
  if (REGION_PATTERN.test(filename)) return 'internal';
  return 'client';
}

function extractChatNameFromHeader(text: string): string {
  // First line of an export: "[DD/MM/YY, HH:MM:SS AM] <ChatName>: ‎Messages and calls..."
  const m = text.match(/^\[[^\]]+\]\s+(.+?):\s+/);
  return m ? m[1].trim() : '';
}

interface IngestResult {
  pid: number;
  chatType: 'client' | 'internal';
  chatName: string;
  inserted: number;
  parsedTotal: number;
  firstDate?: Date;
  lastDate?: Date;
}

async function ingestFile(filePath: string): Promise<IngestResult | null> {
  const filename = basename(filePath);
  const pid = extractPid(filename);
  if (!pid) {
    console.warn(`  SKIP: cannot extract PID from ${filename}`);
    return null;
  }

  const text = await fs.readFile(filePath, 'utf8');
  const messages: Message[] = parseString(text, { daysFirst: true });
  if (messages.length === 0) {
    console.warn(`  SKIP: no messages parsed in ${filename}`);
    return null;
  }

  const chatName = extractChatNameFromHeader(text);
  const chatType = classifyChatType(chatName, filename);

  // Drop system messages (author === null)
  const real = messages.filter((m) => m.author !== null);
  if (real.length === 0) return { pid, chatType, chatName, inserted: 0, parsedTotal: 0 };

  // Drop end-to-end-encryption notice and "added you" / "created group" lines that
  // sometimes leak through with an author (e.g. when the chat name == sender name).
  const SYSTEM_BODY_RE = /^(Messages and calls are end-to-end encrypted|‎)/;

  const rows = real
    .filter((m) => !SYSTEM_BODY_RE.test(m.message))
    .map((m) => ({
      pid,
      source_type: 'whatsapp' as const,
      source: 'export' as const,
      chat_type: chatType,
      group_name: chatName || filename,
      sender_name: m.author,
      body: m.message,
      message_type: 'chat',
      has_media: /\bomitted$/i.test(m.message),
      sent_at: m.date.toISOString(),
    }));

  const CHUNK = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from('signals')
      .upsert(chunk, {
        onConflict: 'pid,sent_at_minute,sender_name,body_hash',
        ignoreDuplicates: true,
      })
      .select('id');
    if (error) {
      console.error(`    ERROR (${filename}): ${error.message}`);
      throw error;
    }
    inserted += data?.length ?? 0;
  }

  return {
    pid,
    chatType,
    chatName,
    inserted,
    parsedTotal: rows.length,
    firstDate: real[0]?.date,
    lastDate: real[real.length - 1]?.date,
  };
}

interface PidSummary {
  client: number;
  internal: number;
  firstDate?: Date;
  lastDate?: Date;
}

async function main() {
  const files = await fs.readdir(EXPORTS_DIR);
  const txtFiles = files.filter((f) => f.toLowerCase().endsWith('.txt')).sort();
  console.log(`Found ${txtFiles.length} .txt exports in ${EXPORTS_DIR}\n`);

  const summary = new Map<number, PidSummary>();
  let filesOk = 0;
  let filesFailed = 0;

  for (const f of txtFiles) {
    console.log(`[${filesOk + filesFailed + 1}/${txtFiles.length}] ${f}`);
    try {
      const r = await ingestFile(resolve(EXPORTS_DIR, f));
      if (!r) {
        filesFailed++;
        continue;
      }
      console.log(
        `  -> PID ${r.pid} (${r.chatType}): inserted ${r.inserted}/${r.parsedTotal} parsed`,
      );

      const cur = summary.get(r.pid) ?? { client: 0, internal: 0 };
      cur[r.chatType] += r.inserted;
      if (r.firstDate && (!cur.firstDate || r.firstDate < cur.firstDate)) {
        cur.firstDate = r.firstDate;
      }
      if (r.lastDate && (!cur.lastDate || r.lastDate > cur.lastDate)) {
        cur.lastDate = r.lastDate;
      }
      summary.set(r.pid, cur);
      filesOk++;
    } catch (e) {
      filesFailed++;
      console.error(`  FAILED: ${(e as Error).message}`);
    }
  }

  console.log(`\nProcessed ${filesOk} ok, ${filesFailed} failed/skipped\n`);
  console.log('=== Per-PID summary (newly inserted rows) ===');
  const sorted = Array.from(summary.entries()).sort(([a], [b]) => a - b);
  for (const [pid, info] of sorted) {
    const range =
      info.firstDate && info.lastDate
        ? `${info.firstDate.toISOString().slice(0, 10)} → ${info.lastDate.toISOString().slice(0, 10)}`
        : 'n/a';
    console.log(
      `  PID ${pid}: client=${info.client}  internal=${info.internal}  range=${range}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
