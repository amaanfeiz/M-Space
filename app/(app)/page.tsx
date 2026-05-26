import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Project } from '@/lib/types/project'
import { formatInr } from '@/lib/types/project'
import type { BriefJSON } from '@/components/intelligence/BriefBody'
import { ALL_AMAAN_PIDS } from '@/lib/static/all_pids'
import { WelcomeBanner } from '@/components/dashboard/WelcomeBanner'
import { StalledProjects } from '@/components/dashboard/StalledProjects'
import { MetricsRow } from '@/components/dashboard/MetricsRow'
import { RiskMonitor } from '@/components/dashboard/RiskMonitor'
import { TeamPerformance, groupByPlanner } from '@/components/dashboard/TeamPerformance'
import { TopOfMind } from '@/components/dashboard/TopOfMind'
import { OpenCommitments } from '@/components/dashboard/OpenCommitments'
import { WhatChangedToday } from '@/components/dashboard/WhatChangedToday'
import type { UrgentPid } from '@/components/dashboard/TopOfMind'
import type { OpenCommitment } from '@/components/dashboard/OpenCommitments'
import type { ChangeItem } from '@/components/dashboard/WhatChangedToday'

const URGENCY_RANK: Record<string, number> = {
  cold: 0, anxious: 1, cautious: 2, neutral: 3, positive: 4,
}

function nowMillis(): number {
  return Date.now()
}

function todayIstYmd(): string {
  return new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10)
}

function MiniSentimentChip({ counts }: { counts: Record<string, number> }) {
  const order = ['cold', 'anxious', 'cautious', 'neutral', 'positive'] as const
  const color: Record<string, string> = {
    cold: 'var(--critical)', anxious: 'var(--critical)',
    cautious: 'var(--attention)', neutral: 'var(--text-dim)', positive: 'var(--healthy)',
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontVariantNumeric: 'tabular-nums' }}>
      {order.map((s) => {
        const n = counts[s] ?? 0
        if (n === 0) return null
        return (
          <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--text-muted)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: color[s] }} />
            {n}
          </span>
        )
      })}
    </div>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) redirect('/login')

  const pidList = [...ALL_AMAAN_PIDS]
  const nowMs = nowMillis()
  const today = todayIstYmd()
  const yesterday = new Date(nowMs - 86400_000 + 5.5 * 3600_000).toISOString().slice(0, 10)

  const [
    { data: projectData, error },
    { data: briefRows },
    { data: signalRows },
    { data: yesterdayBriefRows },
  ] = await Promise.all([
    supabase.from('projects')
      .select(
        'pid, cx_name, status, communication_days, overall_pid_risk, cancellation_risk, current_summary, bgmv, collection, collection_pct, event_start_date, planner, project_health, venue, state, last_message_date, synced_at, t_days',
      )
      .in('pid', pidList),
    supabase
      .from('briefs')
      .select('pid, brief_date, brief_json')
      .in('pid', pidList)
      .order('brief_date', { ascending: false })
      .limit(200),
    supabase
      .from('signals')
      .select('pid, sent_at, body')
      .in('pid', pidList)
      .order('sent_at', { ascending: false })
      .limit(5000),
    supabase
      .from('briefs')
      .select('pid, brief_json')
      .in('pid', pidList)
      .eq('brief_date', yesterday),
  ])

  const baseProjects: Project[] = projectData ?? []

  if (error) {
    console.error('[dashboard] fetch error', error.message)
  }

  const lastSignalByPid = new Map<number, { sentAt: string; body: string | null }>()
  for (const s of signalRows ?? []) {
    if (lastSignalByPid.has(s.pid)) continue
    lastSignalByPid.set(s.pid, { sentAt: s.sent_at, body: s.body })
  }
  const projects: Project[] = baseProjects.map((p) => {
    const last = lastSignalByPid.get(p.pid)
    if (!last) return p
    const daysSilent = Math.floor((nowMs - new Date(last.sentAt).getTime()) / 86400000)
    return { ...p, last_message_date: last.sentAt, communication_days: daysSilent }
  })

  // Latest brief per PID
  type BriefBucket = { brief: BriefJSON; briefDate: string }
  const briefByPid = new Map<number, BriefBucket>()
  for (const b of briefRows ?? []) {
    if (briefByPid.has(b.pid)) continue
    briefByPid.set(b.pid, { brief: b.brief_json as BriefJSON, briefDate: b.brief_date })
  }

  // ── Sentiment counts
  const sentimentCounts: Record<string, number> = { positive: 0, neutral: 0, cautious: 0, anxious: 0, cold: 0 }
  for (const { brief } of briefByPid.values()) {
    const s = brief.client_pulse?.sentiment ?? 'neutral'
    sentimentCounts[s] = (sentimentCounts[s] ?? 0) + 1
  }

  // ── Briefs current today
  const briefsCurrent = [...briefByPid.values()].filter((b) => b.briefDate === today).length

  // ── Yesterday delta
  const yesterdayBriefMap = new Map<number, BriefJSON>()
  for (const b of yesterdayBriefRows ?? []) yesterdayBriefMap.set(b.pid, b.brief_json as BriefJSON)

  let criticalToday = 0, criticalYesterday = 0, stalledToday = 0, stalledYesterday = 0
  for (const { brief } of briefByPid.values()) {
    const s = brief.client_pulse?.sentiment
    if (s === 'cold' || s === 'anxious') criticalToday++
    if ((brief.client_pulse?.days_silent ?? 0) > 14) stalledToday++
  }
  for (const brief of yesterdayBriefMap.values()) {
    const s = brief.client_pulse?.sentiment
    if (s === 'cold' || s === 'anxious') criticalYesterday++
    if ((brief.client_pulse?.days_silent ?? 0) > 14) stalledYesterday++
  }
  const yesterdayDelta = yesterdayBriefRows && yesterdayBriefRows.length > 0
    ? { criticalDelta: criticalToday - criticalYesterday, stalledDelta: stalledToday - stalledYesterday, closedDelta: 0 }
    : null

  // ── Daily nudge
  let dailyNudge: { pid: number; text: string } | null = null
  const nudgeCandidates: Array<{ pid: number; text: string; rank: number }> = []
  for (const [pid, { brief }] of briefByPid) {
    const sentiment = brief.client_pulse?.sentiment ?? 'neutral'
    const rank = URGENCY_RANK[sentiment] ?? 3
    const firstUnack = brief.unacknowledged_requests?.[0]
    const firstUrgent = brief.needs_you?.find((n) => n.priority === 'urgent')
    if (firstUnack) {
      nudgeCandidates.push({ pid, text: `Unanswered ${firstUnack.days_unanswered}d: "${firstUnack.request}"`, rank })
    } else if (firstUrgent) {
      nudgeCandidates.push({ pid, text: firstUrgent.headline || firstUrgent.action || '', rank })
    }
  }
  nudgeCandidates.sort((a, b) => a.rank - b.rank)
  if (nudgeCandidates[0]) dailyNudge = { pid: nudgeCandidates[0].pid, text: nudgeCandidates[0].text }

  // ── Metrics
  const livePids = projects.filter((p) => p.status === 'Booked').length
  const totalBgmv = formatInr(projects.reduce((s, p) => s + (p.bgmv ?? 0), 0))
  const criticalPidCount = criticalToday
  const totalContracted = projects.reduce((s, p) => s + (p.bgmv ?? 0), 0)
  const totalCollected = projects.reduce((s, p) => s + ((p as { collection?: number }).collection ?? 0), 0)
  const avgCollectionPct = totalContracted > 0 ? Math.round((totalCollected / totalContracted) * 100) : 0

  // ── Top of Mind: per-PID grouping
  // Exclude post-event PIDs (handoff SOP-34: post-event excluded from "important")
  const urgentByPid: UrgentPid[] = []
  for (const [pid, { brief }] of briefByPid) {
    const project = projects.find((p) => p.pid === pid)
    if (project?.status === 'Concluded' || project?.status === 'Cancelled') continue
    if ((project?.t_days ?? 0) < -7) continue
    const items: UrgentPid['items'] = []
    for (const r of brief.unacknowledged_requests ?? []) {
      items.push({ kind: 'unanswered', text: r.request, meta: `unanswered ${r.days_unanswered}d` })
    }
    for (const n of brief.needs_you ?? []) {
      if (n.priority === 'urgent') items.push({ kind: 'needs_you', text: n.headline || n.action || '' })
    }
    if (items.length === 0) continue
    urgentByPid.push({
      pid,
      cxName: project?.cx_name ?? null,
      sentiment: brief.client_pulse?.sentiment ?? 'neutral',
      daysSilent: brief.client_pulse?.days_silent ?? 0,
      items,
    })
  }
  const topPids = urgentByPid
    .sort((a, b) => {
      const ra = URGENCY_RANK[a.sentiment] ?? 3
      const rb = URGENCY_RANK[b.sentiment] ?? 3
      if (ra !== rb) return ra - rb
      return b.items.length - a.items.length
    })
    .slice(0, 5)

  // ── Stalled
  const stalledProjects = projects.filter(
    (p) => p.status !== 'Cancelled' && p.status !== 'Concluded',
  )

  // ── Tracker risks
  const riskRows = [...projects]
    .sort((a, b) => (b.cancellation_risk ?? 0) - (a.cancellation_risk ?? 0))
    .slice(0, 5)

  // ── Open commitments
  const openCommitments: OpenCommitment[] = []
  const todayMs = nowMs
  for (const [pid, { brief }] of briefByPid) {
    const project = projects.find((p) => p.pid === pid)
    for (const c of brief.commitments ?? []) {
      if (c.status !== 'open' && c.status !== 'overdue') continue
      const dueMs = c.due ? new Date(c.due).getTime() : null
      const daysOverdueRaw = dueMs != null ? Math.floor((todayMs - dueMs) / 86400000) : null
      const isOverdue = c.status === 'overdue' || (daysOverdueRaw != null && daysOverdueRaw > 0)
      openCommitments.push({
        pid,
        cxName: project?.cx_name ?? null,
        what: c.what,
        owner: c.owner,
        status: isOverdue ? 'overdue' : 'open',
        daysOverdue: isOverdue && daysOverdueRaw != null && daysOverdueRaw > 0 ? daysOverdueRaw : null,
      })
    }
  }
  openCommitments.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'overdue' ? -1 : 1
    return (b.daysOverdue ?? 0) - (a.daysOverdue ?? 0)
  })
  const topCommitments = openCommitments.slice(0, 5)

  // ── What Changed Today
  const changeItems: ChangeItem[] = []
  for (const [pid, { brief }] of briefByPid) {
    const project = projects.find((p) => p.pid === pid)
    const sentiment = brief.client_pulse?.sentiment ?? 'neutral'
    for (const change of brief.what_changed ?? []) {
      changeItems.push({ pid, cxName: project?.cx_name ?? null, sentiment, text: change })
    }
  }
  const topChanges = changeItems
    .sort((a, b) => (URGENCY_RANK[a.sentiment] ?? 3) - (URGENCY_RANK[b.sentiment] ?? 3))
    .slice(0, 8)
  const latestBriefDate = briefRows?.[0]?.brief_date ?? null

  // ── Team Performance
  const planners = groupByPlanner(projects)

  // ── User display
  const emailLocal = user.email.split('@')[0] ?? ''
  const nameParts = emailLocal.split('.').filter(Boolean)
  const userName = nameParts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')

  return (
    <>
      <div className="page-header">
        <div className="page-header-text">
          <h1>Dashboard</h1>
          <p>{projects.length} PIDs</p>
        </div>
        <MiniSentimentChip counts={sentimentCounts} />
      </div>
      <WelcomeBanner
        userName={userName}
        totalPids={projects.length}
        sentimentCounts={sentimentCounts}
        briefsCurrent={briefsCurrent}
        yesterdayDelta={yesterdayDelta}
        dailyNudge={dailyNudge}
      />
      <TopOfMind pids={topPids} />
      <MetricsRow
        livePids={livePids}
        totalBgmv={totalBgmv}
        criticalPidCount={criticalPidCount}
        avgCollectionPct={avgCollectionPct}
        totalCollected={totalCollected}
        totalContracted={totalContracted}
      />
      <StalledProjects projects={stalledProjects} />
      <TeamPerformance planners={planners} />
      <div className="panels-row">
        <RiskMonitor projects={riskRows} />
        <OpenCommitments commitments={topCommitments} />
      </div>
      <WhatChangedToday items={topChanges} briefDate={latestBriefDate} />
    </>
  )
}
