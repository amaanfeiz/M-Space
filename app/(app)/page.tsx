import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function makeBriefingEyebrow(): string {
  const nowIst = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
  return `Executive Briefing · ${nowIst.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  })} · ${nowIst.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  })}`
}
import type { Project } from '@/lib/types/project'
import { RISK_ORDER, formatInr } from '@/lib/types/project'
import { WelcomeBanner } from '@/components/dashboard/WelcomeBanner'
import { WhatChanged } from '@/components/dashboard/WhatChanged'
import { StalledProjects } from '@/components/dashboard/StalledProjects'
import { ExecutiveBriefing } from '@/components/dashboard/ExecutiveBriefing'
import { MetricsRow } from '@/components/dashboard/MetricsRow'
import { TodaysPriorities } from '@/components/dashboard/TodaysPriorities'
import { RiskMonitor } from '@/components/dashboard/RiskMonitor'
import { TeamPerformance, groupByPlanner } from '@/components/dashboard/TeamPerformance'
import { ActivityFeed } from '@/components/dashboard/ActivityFeed'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) redirect('/login')

  const { data, error } = await supabase.from('projects').select(
    'pid, cx_name, status, communication_days, overall_pid_risk, cancellation_risk, current_summary, bgmv, collection_pct, event_start_date, planner, project_health, venue, state, last_message_date, synced_at',
  )

  const projects: Project[] = data ?? []

  if (error) {
    console.error('[dashboard] fetch error', error.message)
  }

  // ── Metrics
  const livePids = projects.filter((p) => p.status === 'Booked').length
  const totalBgmv = formatInr(projects.reduce((s, p) => s + (p.bgmv ?? 0), 0))
  const criticalCount = projects.filter((p) => p.overall_pid_risk === 'Critical').length
  const attentionCount = projects.filter((p) => p.overall_pid_risk === 'Attention').length

  // ── By risk severity then cancellation_risk desc
  const byRisk = [...projects].sort((a, b) => {
    const ra = RISK_ORDER[a.overall_pid_risk ?? ''] ?? 99
    const rb = RISK_ORDER[b.overall_pid_risk ?? ''] ?? 99
    if (ra !== rb) return ra - rb
    return (b.cancellation_risk ?? 0) - (a.cancellation_risk ?? 0)
  })

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

  // ── Today's Priorities: top 5
  const priorities = byRisk.slice(0, 5)

  // ── Risk Monitor: top 5 by cancellation_risk
  const riskRows = [...projects]
    .sort((a, b) => (b.cancellation_risk ?? 0) - (a.cancellation_risk ?? 0))
    .slice(0, 5)

  // ── What Changed: top 7 by last_message_date desc
  const recentlyActive = [...projects]
    .filter((p) => p.current_summary)
    .sort(
      (a, b) =>
        new Date(b.last_message_date ?? b.synced_at ?? 0).getTime() -
        new Date(a.last_message_date ?? a.synced_at ?? 0).getTime(),
    )
    .slice(0, 7)

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

  // ── Sync time from most recent project
  const syncedAt = projects[0]?.synced_at ?? null

  // ── Briefing eyebrow
  const briefingEyebrow = makeBriefingEyebrow()

  return (
    <>
      <WelcomeBanner
        userName={userName}
        userInitials={userInitials}
        topProjects={byRisk.slice(0, 3)}
      />
      <WhatChanged projects={recentlyActive} syncedAt={syncedAt} />
      {stalled.length > 0 && <StalledProjects projects={stalled} />}
      <ExecutiveBriefing
        projects={projects}
        criticalCount={criticalCount}
        attentionCount={attentionCount}
        totalBgmv={totalBgmv}
        eyebrow={briefingEyebrow}
      />
      <MetricsRow
        livePids={livePids}
        totalBgmv={totalBgmv}
        criticalCount={criticalCount}
        attentionCount={attentionCount}
      />
      <div className="panels-row fade-in" style={{ animationDelay: '300ms' }}>
        <TodaysPriorities projects={priorities} />
        <RiskMonitor projects={riskRows} />
      </div>
      <TeamPerformance planners={planners} />
      <ActivityFeed projects={activityProjects} />
    </>
  )
}
