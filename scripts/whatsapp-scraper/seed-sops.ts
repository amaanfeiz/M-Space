// Phase 1 — Step 11: seed 36 SOPs from Phase 1 handoff § 18 into public.sops.
//
// Idempotent. Re-running upserts each row by sop_id without changing
// created_at. Vault remains the canonical source of truth — when SOPs are
// edited in the vault's sops/ folder, re-run this script to sync.
//
// Usage:
//   npx tsx seed-sops.ts

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '../../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type Sop = {
  sop_id: string;
  stage: string;
  package_tier: string;
  role: string;
  category: string;
  title: string;
  body: string;
  framework_source: string;
};

const SOPS: Sop[] = [
  {
    sop_id: 'SOP-01',
    stage: 'Onboarding', package_tier: 'All', role: 'TL', category: 'Team Assignment',
    title: 'Assign Team Once Venue and Dates Are Final',
    body: 'Each morning, the TL should filter the destination live tracker to their name and check new bookings where planner, designer, or PM are blank. If the venue is booked and event dates are finalized, the TL should assign an available planner/designer/PM team and update the CRM/internal group. This is high-priority because it is quick to fix and blocks planning from starting.',
    framework_source: 'DRI',
  },
  {
    sop_id: 'SOP-02',
    stage: 'Onboarding', package_tier: 'All', role: 'Planner', category: 'Handover',
    title: 'RM Handover Must Be Captured Within 24 Hours',
    body: 'After team assignment, the planner should receive RM handover and minutes of meeting within 24 hours, confirm contract status, and ensure any missing handover context is chased immediately. Missing handover makes later planning reactive and unclear.',
    framework_source: 'DRI',
  },
  {
    sop_id: 'SOP-03',
    stage: 'Onboarding', package_tier: 'All', role: 'Planner', category: 'First Client Contact',
    title: 'Intro Call Availability Must Be Requested Within One Week, Follow-Up Visible',
    body: 'Within the first week of active assignment / contract confirmation, the planner must have asked the client for intro-call availability and shown visible follow-up if the client is delayed. The call itself may be scheduled beyond week 1 if the client is busy, provided the availability request was made in week 1 and subsequent follow-ups are visible. Flag if no availability request has been made by day 7.',
    framework_source: 'Moments of Truth',
  },
  {
    sop_id: 'SOP-04',
    stage: 'Client Communication', package_tier: 'All', role: 'Planner/Designer/PM', category: 'Response Standards',
    title: 'Substantive Client Ask Must Be Acknowledged Within One Day',
    body: 'Any proper client question or actionable request must be acknowledged within about one day. The response can be a direct answer or a clear "we will get back by X" timeline. Leaving a client question unacknowledged damages service confidence and can force the client into follow-up mode.',
    framework_source: 'Moments of Truth',
  },
  {
    sop_id: 'SOP-05',
    stage: 'Client Communication', package_tier: 'All', role: 'Planner/Designer/PM', category: 'Timeline Setting',
    title: 'Replace "Soon" With a Clear Timeline',
    body: 'Client-facing commitments should not use vague language like "soon" for deliverables. The team should state a date or duration, such as "in 3 days" or "by Thursday." If the timeline is uncertain, the team must still give the next update time.',
    framework_source: 'Cialdini - Commitment and Consistency',
  },
  {
    sop_id: 'SOP-06',
    stage: 'Client Communication', package_tier: 'All', role: 'Planner', category: 'Delay Management',
    title: 'Proactively Update Client Before a Promised Timeline Breaks',
    body: 'If a promised deliverable cannot be sent by the committed date, the planner should update the client before the deadline passes, explain the blocker, share partial progress if available, and give a new timeline. Silent deadline breach is treated as a stronger failure than an explained delay.',
    framework_source: 'Service Recovery Paradox',
  },
  {
    sop_id: 'SOP-07',
    stage: 'Client Communication', package_tier: 'All', role: 'Planner', category: 'Call Documentation',
    title: 'Client Call Summary Must Be Posted Within 24 Hours',
    body: 'Every personal client call must be summarized in the client WhatsApp group within 24 hours. The summary should include key points discussed, decisions, action items, owners, and timelines. This protects client alignment, team visibility, AI monitoring, and future dispute handling.',
    framework_source: 'DRI',
  },
  {
    sop_id: 'SOP-08',
    stage: 'Client Communication', package_tier: 'All', role: 'Planner', category: 'Google Meet Documentation',
    title: 'Google Meet Needs Recording, Gemini Notes, and Group Action Summary',
    body: 'For Google Meets, the team should start recording where possible and enable Gemini notes, but still post a client-group action summary afterward. The client should not be expected to inspect notes later to know what was agreed.',
    framework_source: 'DRI',
  },
  {
    sop_id: 'SOP-09',
    stage: 'Client Communication', package_tier: 'All', role: 'Planner', category: 'Off-Group Movement',
    title: 'Personal Chat Movement Must Be Recapped in Client Group',
    body: 'If planning movement happens through personal chat or call, the planner must recap major points and next steps in the client group. Personal movement without a group trail is a visibility risk and prevents TL/team/AI from accurately monitoring project health.',
    framework_source: 'Radical Candor',
  },
  {
    sop_id: 'SOP-10',
    stage: 'Active Planning', package_tier: 'All', role: 'Planner', category: 'Vendor Closure',
    title: 'Photo and Makeup Are First-Quarter Trust Anchors',
    body: 'In a normal six-month active planning runway, photography and makeup should ideally be locked within the first 25% of the runway, along with movement beyond the booking fee. These are high-value trust anchors that show real progress and reduce cancellation risk.',
    framework_source: 'Moments of Truth',
  },
  {
    sop_id: 'SOP-11',
    stage: 'Active Planning', package_tier: 'All', role: 'Planner', category: 'Vendor Closure',
    title: 'Mid-Runway Should Show DJ, MC, Entertainment, and Decor Progress',
    body: 'By around the halfway point of a six-month planning runway, DJ and MC/anchor should ideally be locked, entertainment discussion should be active, and decor should be underway. Smaller services should begin closing so the final quarter does not become basic vendor discovery.',
    framework_source: 'Big 3 Leadership',
  },
  {
    sop_id: 'SOP-12',
    stage: 'Final Planning', package_tier: 'All', role: 'Planner/PM/Designer', category: 'Pre-Event Readiness',
    title: 'Final Quarter Is for Operational Depth, Not Basic Closure',
    body: 'In the final 25% of the planning runway, all vendors, small services, licenses, ownership confirmations, and payments should be locked or clearly tracked. The team should shift attention to show flow, run-of-show, briefing, hospitality, logistics, and execution readiness.',
    framework_source: 'Moments of Truth',
  },
  {
    sop_id: 'SOP-13',
    stage: 'Collections', package_tier: 'All', role: 'Planner', category: 'Payment Planning',
    title: 'Payment Tracker and Installment Expectations Must Be Added Early',
    body: 'At the start of active planning, the planner should add the payment tracker and expected planning-fee/installment milestones to the master sheet. Because the contract only specifies full payment by T-21, not detailed installment timing, early tracker visibility prevents surprise and protects client trust when later payment asks are made.',
    framework_source: 'Cialdini - Commitment and Consistency',
  },
  {
    sop_id: 'SOP-14',
    stage: 'Collections', package_tier: 'All', role: 'Planner', category: 'Collection Movement',
    title: 'Collection Should Move Beyond Booking Fee by End of First Runway Quarter',
    body: 'By the end of the first 25% of active planning runway, collection should move beyond the Rs 25,000 booking fee. If the project is still only at booking fee, the TL should ask why there has been no result-linked collection movement.',
    framework_source: 'DRI',
  },
  {
    sop_id: 'SOP-15',
    stage: 'Collections', package_tier: 'All', role: 'Planner/PM', category: 'T-21 Collection',
    title: 'Start 100 Percent Collection Tracking at T-21',
    body: 'From 21 days before event, the team must actively track 100% collection status and timeline because the contract requires full payment by T-21. Later payment may be tolerated in real cases only when explicitly documented, such as a known cash carry plan.',
    framework_source: 'DRI',
  },
  {
    sop_id: 'SOP-16',
    stage: 'Vendor Closure', package_tier: 'All', role: 'Planner/PM', category: 'Commercial Trail',
    title: 'Vendor Lock Requires SP, CP, Advance, Margin, and Payment Timeline',
    body: 'When a vendor is finalized, the internal group/tracker must capture CP, SP, markup or commission logic, client advance due/received, vendor advance payable, retained margin, and payment schedule. A vendor should not be considered properly closed if the commercial trail is missing. CP/SP/margin must remain internal-only; appearance of these in the client group is a severity-1 trust risk.',
    framework_source: 'DRI',
  },
  {
    sop_id: 'SOP-17',
    stage: 'Vendor Optioning', package_tier: 'All', role: 'Planner/Designer/PM', category: 'Master Sheet Quality',
    title: 'Vendor Options Shared in Master Sheet Must Be Complete',
    body: 'When the team tells the client vendor options are in the master sheet, the sheet should include working links, pricing, TBL status, and vendor-specific details like DJ tech rider, DJ console-inclusion status, or MC languages. Incomplete options create avoidable follow-ups and weaken confidence.',
    framework_source: 'Moments of Truth',
  },
  {
    sop_id: 'SOP-18',
    stage: 'Client Sentiment', package_tier: 'All', role: 'TL', category: 'Client Silence',
    title: 'Classify Client Silence Separately From Planner Failure',
    body: 'If a normally active client goes silent for more than about 24-30 hours while the planner is proactive, classify as client engagement risk and ask planner what is happening. If the planner is also inactive, classify as planner ownership failure and intervene more strongly.',
    framework_source: 'SBI Feedback',
  },
  {
    sop_id: 'SOP-19',
    stage: 'Escalation', package_tier: 'All', role: 'TL', category: 'TL Visibility',
    title: 'TL Should Avoid Client-Group Entry Unless Trust Is Damaged',
    body: 'The TL should usually intervene internally rather than in the client group, because visible TL entry can reduce planner authority and make the client dependent on the TL. TL enters the client group only when trust, sentiment, planner authority, or continuity is already at risk.',
    framework_source: 'Big 3 Leadership',
  },
  {
    sop_id: 'SOP-20',
    stage: 'Escalation', package_tier: 'All', role: 'TL', category: 'Planner Conduct',
    title: 'Rude or Argumentative Planner Behavior Requires TL Intervention',
    body: 'If a planner becomes rude, argumentative, says something clearly wrong, or makes the client feel small/hurt, the TL should intervene directly, apologize where needed, and consider planner/team reassignment. This is a high-severity sentiment event.',
    framework_source: 'Radical Candor',
  },
  {
    sop_id: 'SOP-21',
    stage: 'Planner Management', package_tier: 'All', role: 'TL', category: 'Internal Nudge Ladder',
    title: 'Repeated Ignored Internal Nudges Become a Direct Planner Call',
    body: 'For missed summaries, collection updates, or process clarifications, the TL should nudge internally first. If two reminders are ignored or a third public follow-up would damage the visible thread, the TL calls the planner directly to understand the blocker and reset ownership. The third nudge is suppressed not by count alone but by thread-optics — a third public chase weakens the TL and the team.',
    framework_source: 'SBI Feedback',
  },
  {
    sop_id: 'SOP-22',
    stage: 'Recovery', package_tier: 'All', role: 'TL', category: 'Planner Confidence Failure',
    title: 'Client Confidence Loss May Require Pep Talk or Planner Change',
    body: 'If the client visibly lacks confidence in the planner because of repeated missed deadlines, weak ownership, or poor communication, the TL should either coach the planner immediately or change planner before the project reaches cancellation risk.',
    framework_source: 'Service Recovery Paradox',
  },
  {
    sop_id: 'SOP-23',
    stage: 'Team Continuity', package_tier: 'All', role: 'TL', category: 'Planner Exit',
    title: 'TL Temporarily Owns Client Reassurance When Planner Exits Without Replacement',
    body: 'If a planner resigns/leaves and no replacement is available, the TL may introduce himself to the client as planning leader, reassure them they are in safe hands, and temporarily or fully own the project until staffing is resolved.',
    framework_source: 'Moments of Truth',
  },
  {
    sop_id: 'SOP-24',
    stage: 'Licenses', package_tier: 'All', role: 'PM/Planner', category: 'License Readiness',
    title: 'License Requirements Should Be Collected 45-60 Days Before Event',
    body: 'License requirements should be collected from venue POC by mail 45-60 days before event, with agent contact and ownership clarified with client. Missing license clarity in the final quarter creates avoidable operational risk.',
    framework_source: 'DRI',
  },
  {
    sop_id: 'SOP-25',
    stage: 'Post-Event', package_tier: 'All', role: 'Planner/PM/VM', category: 'Closure',
    title: 'Post-Event Closure Must Preserve Peak-End Experience',
    body: 'Within 48 hours of the last event date, collect client feedback and begin closure actions such as thank-you notes, album/video tracking, reconciliation, P&L update, and PID archival. The end experience strongly shapes client memory of the service.',
    framework_source: 'Peak-End Rule',
  },
  {
    sop_id: 'SOP-26',
    stage: 'Client Communication', package_tier: 'All', role: 'Planner', category: 'Sentiment Coloring',
    title: 'Add a Sentiment-Color Line on Top of Post-Call MOM',
    body: 'Beyond the factual MOM with actions, owners, and timelines, the planner should ideally post a one-line sentiment-color message conveying client mood after a call or meet ("glad the call went well, looking forward to closing X by Y"). This makes mood legible to the AI, the TL, and the strategy team\'s sentiment tracker. The MOM is mandatory; the sentiment-color line is ideal.',
    framework_source: 'Peak-End Rule',
  },
  {
    sop_id: 'SOP-27',
    stage: 'Active Planning', package_tier: 'All', role: 'Designer', category: 'Design Surface',
    title: 'Designer Must Originate Design Surface on Client Group Within 1-2 Weeks of Intro Call',
    body: 'Within 1-2 weeks of the intro call, the designer must originate at least one design-side surface on the client group — decor brief, moodboard, save-the-date, monogram, invite template, or printable concept. Sustained design-side silence beyond 4 weeks is flagged regardless of planner activity. Approach is via internal PID group first.',
    framework_source: 'Moments of Truth',
  },
  {
    sop_id: 'SOP-28',
    stage: 'Active Planning', package_tier: 'All', role: 'PM', category: 'Group Presence',
    title: 'PM Must Maintain Phase-Proportional Group Presence and Meet Voice',
    body: 'A PM must maintain visible client-group presence proportional to phase — light early-phase, mandatory at venue recce and onward. Total silence across the client group and across Gemini Meet transcripts is a process slip. A PM with zero client-group messages across multiple PIDs in a rolling 2-week window is flagged for internal review.',
    framework_source: 'DRI',
  },
  {
    sop_id: 'SOP-29',
    stage: 'Vendor Sourcing', package_tier: 'All', role: 'VM', category: 'Deadline Commitment',
    title: 'VM Must Respond to Vendor Requests with a Deadline',
    body: 'When a planner or PM tags VM in the internal group with a vendor request (service, budget, requirements), VM must respond with a concrete deadline for sharing options. Responding without a deadline — or "we\'ll get back soon" — is the VM equivalent of the team\'s "soon" to the client and is flagged. VM should also post proactive status updates on open requests rather than waiting to be chased.',
    framework_source: 'DRI',
  },
  {
    sop_id: 'SOP-30',
    stage: 'Cancellation Risk', package_tier: 'All', role: 'TL', category: 'Self-Sourcing Watch',
    title: 'Client Self-Sourcing Intent Is Severity-1 From First Mention',
    body: 'Any client message indicating they will book or are booking a vendor themselves is severity-1 from the first instance and treated as a cancellation precursor — a structural confidence collapse. Carve-out: if the message contains a relationship signal (cousin, uncle, family friend, relative, "my [profession]"), it downgrades to a small trend-watch flag, not severity-1.',
    framework_source: 'Moments of Truth',
  },
  {
    sop_id: 'SOP-31',
    stage: 'Client Communication', package_tier: 'All', role: 'Planner/TL', category: 'Hard Refusal Channel',
    title: 'Client-Facing Hard Refusals Must Move to Call, Not Text',
    body: 'Any client-facing hard refusal — refusing a bulk-payment ask, rejecting scope creep, refusing an unrealistic timeline, holding a pricing line — must be delivered on call, not in the client-group text thread. The client group only carries the "let\'s connect on a call" message before the call and the recap MOM after. Internal-group discussion of the refusal is unrestricted.',
    framework_source: 'Service Recovery Paradox',
  },
  {
    sop_id: 'SOP-32',
    stage: 'Recovery', package_tier: 'All', role: 'TL', category: 'Recovery Sequence',
    title: 'Recovery Call Opens With Credentials, Not Apology',
    body: 'When recovering a broken client relationship on call, the TL opens with credential establishment (post, experience, authority), then apology and reason it won\'t repeat, then action plan (team swap scope, personal oversight, optional on-site presence). Apology before credentials is a weaker move. Default team swap is whole-team; roles are preserved only when the client has visible active investment in that person\'s work.',
    framework_source: 'Service Recovery Paradox',
  },
  {
    sop_id: 'SOP-33',
    stage: 'Recovery', package_tier: 'All', role: 'TL', category: 'Post-Recovery Vigilance',
    title: 'Post-Recovery Vigilance Is Sentiment-Gated, Not Time-Gated',
    body: 'After a recovery call, the TL does not enter the client group but watches the new team\'s first call and its action-item trail more closely than baseline. The vigilance window ends when the client\'s group tone reads sustained-positive — not just one warm message, but a stable shift back into proactive engagement. Until then, the dashboard keeps a heightened-monitoring flag on the PID with elevated severity for visibility gaps, missing MOMs, and silent stretches.',
    framework_source: 'Peak-End Rule',
  },
  {
    sop_id: 'SOP-34',
    stage: 'Dashboard', package_tier: 'All', role: 'AI/System', category: 'Phase Awareness',
    title: 'Post-Event PIDs Are Excluded From Pending and Important Views',
    body: 'PIDs that have crossed event execution are excluded from the main planning dashboard\'s pending and important sections to prevent pollution of the live-PID view. Post-event PIDs surface in a separate low-priority view. A dedicated post-event SOP set will be developed closer to the November season.',
    framework_source: 'DRI',
  },
  {
    sop_id: 'SOP-35',
    stage: 'Triage', package_tier: 'All', role: 'AI/System', category: 'Multi-Signal Triage',
    title: 'When Flags Stack, Client-Experienced Flags Outrank Hidden Process Flags',
    body: 'When a PID has multiple active flags, the flag the client is currently experiencing — visibly waiting on, expressed annoyance, active follow-up — takes priority over higher-category flags the client has no awareness of. Category severity is the macro filter; client-visibility is the intra-day filter. Hidden process gaps the client doesn\'t know about sit below all client-experienced flags and are addressable in the next 24-48h cycle.',
    framework_source: 'Peak-End Rule',
  },
  {
    sop_id: 'SOP-36',
    stage: 'Sentiment', package_tier: 'All', role: 'AI/System', category: 'Family Dynamics',
    title: 'Family Member Presence Is Not a Flag; Family Concern Is',
    body: 'Family members on the client group are baseline — in roughly 30% of PIDs, family (typically father, sometimes mother) is the primary point of contact. AI should not flag family entry to the group. The flag is family members raising a concern — payment objection, complaint about pace, sentiment escalation. A parent figure\'s concern is severity-up over the bride/groom raising the same complaint.',
    framework_source: 'SBI Feedback',
  },
];

async function main() {
  console.log(`Seeding ${SOPS.length} SOPs into public.sops...\n`);

  let inserted = 0;

  for (const s of SOPS) {
    const { error } = await supabase
      .from('sops')
      .upsert(
        {
          sop_id: s.sop_id,
          stage: s.stage,
          package_tier: s.package_tier,
          role: s.role,
          category: s.category,
          title: s.title,
          body: s.body,
          framework_source: s.framework_source,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'sop_id' },
      );

    if (error) {
      console.error(`${s.sop_id} error: ${error.message}`);
    } else {
      inserted++;
    }
  }

  // Count by stage for verification
  const { data: byStage } = await supabase
    .from('sops')
    .select('stage');

  const stageCounts: Record<string, number> = {};
  for (const row of byStage ?? []) {
    const stage = row.stage as string;
    stageCounts[stage] = (stageCounts[stage] ?? 0) + 1;
  }

  console.log(`\n=== Done ===`);
  console.log(`Upserted: ${inserted}/${SOPS.length}`);
  console.log(`\nBy stage:`);
  for (const [stage, count] of Object.entries(stageCounts).sort()) {
    console.log(`  ${stage}: ${count}`);
  }
}

main().catch((err) => {
  console.error('FATAL:', err instanceof Error ? err.message : err);
  process.exit(1);
});
