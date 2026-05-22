import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '../../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const TEST_PID = process.argv[2] ?? '24292';

const SYSTEM_PROMPT = `You are an operations analyst for Meragi Celebrations, a destination wedding company in India.
You will be given recent WhatsApp messages from a client group and an internal team group for a single wedding project.
Produce a structured daily briefing for the Team Lead. Be terse and specific — no filler, no marketing language.

GROUNDING RULES (these matter more than completeness):
1. Only state a fact if it is clearly supported by a message in the input. If something is unclear, write "status unclear" or "not stated" — DO NOT GUESS.
2. NEVER invent specifics that are not in the messages. Do not name product varieties, flower types, room numbers, brands, quantities, or prices unless they appear verbatim in a message.
3. Every bullet point MUST end with a date citation in the format [DD MMM] referencing the most recent message that supports it. Example: "Final run-through call done [02 May]"
4. If you are summarizing across multiple messages, cite the most recent one.
5. If a status is genuinely ambiguous, say so explicitly. "Payment status unclear from messages [01 May]" is more useful than a confident wrong answer.
6. RECENCY RULE: When the same topic appears across multiple messages over time, use the MOST RECENT message as the current status. If a later message updates or supersedes an earlier one (e.g., "payment sent, will reflect by X" → "payment confirmed received by vendor"), the later message wins. Do not report stale status when a more recent update exists in the messages.

Format your response exactly like this (plain text, no markdown headers, no asterisks):

CLIENT PULSE
- [2-3 bullets: what the client is asking/feeling/doing, each ending with [DD MMM]]

TEAM STATUS
- [2-3 bullets: what the internal team is working on, blockers, decisions, each ending with [DD MMM]]

OPEN ITEMS
- [concrete things that need action today, each ending with [DD MMM]]

RISK SIGNAL
[One sentence: green / amber / red and why, citing the most recent supporting message]`;

async function getMessages(groupType: 'client' | 'internal') {
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select('sender_name, body, sent_at, group_type')
    .eq('pid', parseInt(TEST_PID))
    .eq('group_type', groupType)
    .not('body', 'is', null)
    .order('sent_at', { ascending: true });

  if (error) throw new Error(`Supabase error: ${error.message}`);
  return data ?? [];
}

function formatMessages(messages: Awaited<ReturnType<typeof getMessages>>) {
  return messages
    .map((m) => `[${new Date(m.sent_at).toLocaleDateString('en-IN')}] ${m.sender_name ?? 'Unknown'}: ${m.body}`)
    .join('\n');
}

async function runModel(model: string, userContent: string): Promise<string> {
  const response = await anthropic.messages.create({
    model,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
  });
  return response.content[0].type === 'text' ? response.content[0].text : '';
}

async function main() {
  console.log(`Fetching messages for PID ${TEST_PID}...\n`);

  const [clientMsgs, internalMsgs] = await Promise.all([
    getMessages('client'),
    getMessages('internal'),
  ]);

  console.log(`Client messages: ${clientMsgs.length}`);
  console.log(`Internal messages: ${internalMsgs.length}\n`);

  if (clientMsgs.length === 0 && internalMsgs.length === 0) {
    console.log('No messages found for this PID. Did you scrape it?');
    process.exit(1);
  }

  const userContent = `PROJECT: PID ${TEST_PID}

=== CLIENT GROUP (last ${clientMsgs.length} messages) ===
${formatMessages(clientMsgs)}

=== INTERNAL TEAM GROUP (last ${internalMsgs.length} messages) ===
${formatMessages(internalMsgs)}`;

  console.log('Running Haiku and Sonnet in parallel with stricter prompt...\n');

  const [haikuOutput, sonnetOutput] = await Promise.all([
    runModel('claude-haiku-4-5-20251001', userContent),
    runModel('claude-sonnet-4-6', userContent),
  ]);

  console.log('═'.repeat(60));
  console.log(`HAIKU 4.5 OUTPUT — PID ${TEST_PID}`);
  console.log('═'.repeat(60));
  console.log(haikuOutput);

  console.log('\n' + '═'.repeat(60));
  console.log(`SONNET 4.6 OUTPUT — PID ${TEST_PID}`);
  console.log('═'.repeat(60));
  console.log(sonnetOutput);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
