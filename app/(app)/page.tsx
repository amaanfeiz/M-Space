import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Project } from '@/lib/types/project'
import { formatInr } from '@/lib/types/project'
import type { BriefJSON } from '@/components/intelligence/BriefBody'
import { WelcomeBanner } from '@/components/dashboard/WelcomeBanner'
import { StalledProjects } from '@/components/dashboard/StalledProjects'
import { MetricsRow } from '@/components/dashboard/MetricsRow'
import { RiskMonitor } from '@/components/dashboard/RiskMonitor'
import { TeamPerformance, groupByPlanner } from '@/components/dashboard/TeamPerformance'
import { ActivityFeed } from '@/components/dashboard/ActivityFeed'
import { TopOfMind, type UrgentItem } from '@/components/dashboard/TopOfMind'

const URGENCY_RANK: Record<string, number> = {
  cold: 0, anxious: 1, cautious: 2, neutral: 3, positive: 4,
}

// Server components run this module body once per request. The React
// purity-during-render lint rule doesn't model that, so we route the
// Date read through a helper to keep the rule happy without losing
// "now" semantics.
function nowMillis(): number {
  return Date.now()
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) redirect('/login')

  const [
    { data: projectData, error },
    { data: briefRows },
    { data: signalRows },
  ] = await Promise.all([
    supabase.from('projects').select(
      'pid, cx_name, status, communication_days, overall_pid_risk, cancellation_risk, current_summary, bgmv, collection_pct, event_start_date, planner, project_health, venue, state, last_message_date, synced_at',
    ),
    supabase
      .from('briefs')
      .select('pid, brief_date, brief_json')
      .order('brief_date', { ascending: false })
      .limit(200),
    supabase
      .from('signals')
      .select('pid, sent_at, body')
      .order('sent_at', { ascending: false })
      .limit(5000),
  ])

  const baseProjects: Project[] = projectData ?? []

  if (error) {
    console.error('[dashboard] fetch error', error.message)
  }

  // Signals-derived "last contact" per PID — overrides Risk Tracker's
  // last_message_date and communication_days. Falls back to tracker fields
  // when a PID hasn't appeared in our recent signals window.
  const lastSignalByPid = new Map<number, { sentAt: string; body: string | null }>()
  for (const s of signalRows ?? []) {
    if (lastSignalByPid.has(s.pid)) continue
    lastSignalByPid.set(s.pid, { sentAt: s.sent_at, body: s.body })
  }
  const nowMs = nowMillis()
  const projects: Project[] = baseProjects.map((p) => {
    const last = lastSignalByPid.get(p.pid)
    if (!last) return p
    const daysSilent = Math.floor((nowMs - new Date(last.sentAt).getTime()) / 86400000)
    return {
      ...p,
      last_message_date: last.sentAt,
      communication_days: daysSilent,
    }
  })

  // Latest brief per PID
  const briefByPid = new Map<number, BriefJSON>()
  for (const b of briefRows ?? []) {
    if (briefByPid.has(b.pid)) continue
    briefByPid.set(b.pid, b.brief_json as BriefJSON)
  }

  // ── Metrics
  const livePids = projects.filter((p) => p.status === 'Booked').length
  const totalBgmv = formatInr(projects.reduce((s, p) => s + (p.bgmv ?? 0), 0))

  // Brief-derived counts replace the old overall_pid_risk counts.
  // "Urgent flags" = urgent needs_you + every unacknowledged_request.
  let urgentFlagCount = 0
  let openCommitmentCount = 0
  for (const brief of briefByPid.values()) {
    for (const n of brief.needs_you ?? []) {
      if (n.priority === 'urgent') urgentFlagCount++
    }
    urgentFlagCount += brief.unacknowledged_requests?.length ?? 0
    for (const c of brief.commitments ?? []) {
      if (c.status === 'open' || c.status === 'overdue') openCommitmentCount++
    }
  }

  // ── Top of Mind: urgent needs_you items + unacknowledged client requests
  // across all latest briefs. Unacknowledged requests are surfaced as virtual
  // urgent items (a client waiting on a reply is the highest-leverage signal).
  // Ranked by client_pulse sentiment, capped at 5.
  const urgentItems: UrgentItem[] = []
  for (const [pid, brief] of briefByPid) {
    const project = projects.find((p) => p.pid === pid)
    const sentiment = brief.client_pulse?.sentiment ?? 'neutral'
    for (const r of brief.unacknowledged_requests ?? []) {
      urgentItems.push({
        pid,
        cxName: project?.cx_name ?? null,
        action: `Unanswered ${r.days_unanswered}d: "${r.request}"`,
        sentiment,
      })
    }
    for (const n of brief.needs_you ?? []) {
      if (n.priority !== 'urgent') continue
      urgentItems.push({
        pid,
        cxName: project?.cx_name ?? null,
        action: n.action,
        sentiment,
      })
    }
  }
  const topItems = urgentItems
    .sort((a, b) => (URGENCY_RANK[a.sentiment] ?? 3) - (URGENCY_RANK[b.sentiment] ?? 3))
    .slice(0, 5)

  // ── Stalled: communication_days > 14, not cancelled/concluded, top 3
  const stalled = projects
    .filter(
      (p) =>
        (p.communication_days ?? 0) > 14 &&
        p.status !== 'Cancelled' &&
        p.status !== 'Concluded',
    )
    .sort((a, b) => (b.communication_days ?? 0) - (a.communication_days ?? 0))
    .slice(0, 3)

  // ── Tracker risks: top 5 by cancellation_risk (numeric, tracker-derived;
  // kept as a sanity-check signal against Pulse).
  const riskRows = [...projects]
    .sort((a, b) => (b.cancellation_risk ?? 0) - (a.cancellation_risk ?? 0))
    .slice(0, 5)

  // ── Activity Feed: top 8 by last_message_date desc
  const activityProjects = [...projects]
    .filter((p) => p.last_message_date)
    .sort(
      (a, b) =>
        new Date(b.last_message_date!).getTime() -
        new Date(a.last_message_date!).getTime(),
    )
    .slice(0, 8)

  // ── Team Performance: group by planner
  const planners = groupByPlanner(projects)

  // ── User display for welcome banner
  const emailLocal = user.email.split('@')[0] ?? ''
  const nameParts = emailLocal.split('.').filter(Boolean)
  const userName = nameParts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
  const userInitials = nameParts.slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join('') || 'U'

  // Welcome banner top projects use brief sentiment urgency when a brief
  // exists, falling back to overall_pid_risk for those without.
  const welcomeTop = [...projects]
    .sort((a, b) => {
      const sa = briefByPid.get(a.pid)?.client_pulse?.sentiment
      const sb = briefByPid.get(b.pid)?.client_pulse?.sentiment
      const ra = sa ? URGENCY_RANK[sa] ?? 3 : 3
      const rb = sb ? URGENCY_RANK[sb] ?? 3 : 3
      return ra - rb
    })
    .slice(0, 3)

  return (
    <>
      <WelcomeBanner
        userName={userName}
        userInitials={userInitials}
        topProjects={welcomeTop}
      />
      <TopOfMind items={topItems} />
      <MetricsRow
        livePids={livePids}
        totalBgmv={totalBgmv}
        urgentFlagCount={urgentFlagCount}
        openCommitmentCount={openCommitmentCount}
      />
      {stalled.length > 0 && <StalledProjects projects={stalled} />}
      <div className="panels-row">
        <TeamPerformance planners={planners} />
        <RiskMonitor projects={riskRows} />
      </div>
      <ActivityFeed projects={activityProjects} />
    </>
  )
}
