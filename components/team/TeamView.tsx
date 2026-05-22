'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatCouple, formatInr, riskDotClass } from '@/lib/types/project'
import { ROLE_COLOR } from '@/lib/static/teams_static'
import type { ProjectAssignment, TeamGroup, TeamProject } from '@/lib/static/teams_static'

type BriefSummary = { sentiment: string; daysSilent: number; briefDate: string }

type Props = {
  teams: TeamGroup[]
  outliers: ProjectAssignment[]
  salesWip: ProjectAssignment[]
  briefMap: Map<number, BriefSummary>
  filterTeamId?: string
}

const SENTIMENT_COLOR: Record<string, string> = {
  positive: 'var(--healthy)',
  neutral:  'var(--text-dim)',
  cautious: 'var(--attention)',
  anxious:  'var(--critical)',
  cold:     'var(--critical)',
}

const URGENCY_RANK: Record<string, number> = { cold: 0, anxious: 1, cautious: 2, neutral: 3, positive: 4 }

function rowAccentColor(brief: BriefSummary | undefined, risk: string | null): string {
  if (brief?.sentiment && SENTIMENT_COLOR[brief.sentiment]) return SENTIMENT_COLOR[brief.sentiment]
  if (risk === 'Critical') return 'var(--critical)'
  if (risk === 'Attention') return 'var(--attention)'
  return 'transparent'
}

function sortKey(p: ProjectAssignment, briefMap: Map<number, BriefSummary>): number {
  const isPast = (p.t_days ?? 0) < -7
  if (isPast) return 100
  const s = briefMap.get(p.pid)?.sentiment
  return s ? URGENCY_RANK[s] ?? 50 : 50
}

function eventLabel(date: string | null): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
}

function MemberPill({ role, name, initials, roleKey }: {
  role: string; name: string | null; initials: string; roleKey: 'planner' | 'designer' | 'pm'
}) {
  const empty = !name
  const color = ROLE_COLOR[roleKey]
  return (
    <div className={`member-pill${empty ? ' member-pill--empty' : ''}`}>
      <div className="member-avatar" style={empty ? {} : { background: `${color}22`, color }}>
        {initials}
      </div>
      <div className="member-info">
        <div className="member-role">{role}</div>
        <div className="member-name" style={empty ? { color: 'var(--text-dim)' } : {}}>{name ?? 'TBA'}</div>
      </div>
    </div>
  )
}

function MemberInline({ name }: { name: string | null }) {
  if (!name) return <span style={{ fontSize: 11, color: 'var(--text-dim)', minWidth: 70 }}>—</span>
  return (
    <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', minWidth: 70 }}>
      {name.split(' ')[0]}
    </span>
  )
}

function TeamProjectRow({ p, briefMap }: { p: TeamProject; briefMap: Map<number, BriefSummary> }) {
  const brief = briefMap.get(p.pid)
  const accent = rowAccentColor(brief, p.overall_pid_risk)
  const isPast = (p.t_days ?? 0) < -7
  return (
    <div
      className="team-project-row"
      style={{
        boxShadow: accent !== 'transparent' ? `inset 3px 0 0 ${accent}` : undefined,
        opacity: isPast ? 0.55 : 1,
      }}
      onClick={() => { window.location.hash = `#pid=${p.pid}` }}
    >
      <span className={`status-dot ${riskDotClass(p.overall_pid_risk)}`} />
      <span className="team-project-pid">{p.pid}</span>
      <span className="team-project-name">{formatCouple(p.cx_name)}</span>
      <span className="team-project-date">{eventLabel(p.event_start_date)}</span>
      <span className="team-project-bgmv">{formatInr(p.bgmv)}</span>
    </div>
  )
}

function PastEventsToggle({ projects, briefMap }: { projects: TeamProject[]; briefMap: Map<number, BriefSummary> }) {
  const [open, setOpen] = useState(false)
  if (projects.length === 0) return null
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          fontSize: 11, color: 'var(--text-dim)', padding: '6px 0', display: 'flex', alignItems: 'center', gap: 4,
        }}
      >
        <span style={{ fontSize: 9 }}>{open ? '▼' : '▶'}</span>
        {open ? 'Hide' : `+${projects.length} past event${projects.length === 1 ? '' : 's'}`}
      </button>
      {open && projects.map((p) => <TeamProjectRow key={p.pid} p={p} briefMap={briefMap} />)}
    </div>
  )
}

function TeamCard({ t, briefMap, ti }: { t: TeamGroup; briefMap: Map<number, BriefSummary>; ti: number }) {
  const activeProjects = t.projects.filter((p) => (p.t_days ?? 0) >= -7)
  const pastProjects = t.projects.filter((p) => (p.t_days ?? 0) < -7)

  const sorted = [...activeProjects].sort((a, b) => sortKey(a, briefMap) - sortKey(b, briefMap))

  const sentimentCounts = { critical: 0, attention: 0, noBrief: 0 }
  for (const p of t.projects) {
    const brief = briefMap.get(p.pid)
    if (!brief?.sentiment) { sentimentCounts.noBrief++; continue }
    if (brief.sentiment === 'cold' || brief.sentiment === 'anxious') sentimentCounts.critical++
    else if (brief.sentiment === 'cautious') sentimentCounts.attention++
  }

  const segs = t.projects.slice(0, 10).map((p) => {
    const brief = briefMap.get(p.pid)
    const color = rowAccentColor(brief, p.overall_pid_risk)
    return color === 'transparent' ? 'var(--healthy)' : color
  })

  const isIncomplete = t.team.designer.name === null || t.team.pm.name === null

  return (
    <div className={`card card--flat team-card stagger-${(ti % 4) + 1}`}>
      <div className="team-card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div className="team-card-name">{t.team.label}</div>
          {isIncomplete && (
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
              color: 'var(--attention)', border: '1px solid var(--attention)33',
              padding: '1px 5px', borderRadius: 3,
            }}>
              Incomplete
            </span>
          )}
        </div>
        <div className="team-card-meta">
          <Link
            href={`/projects?team=${t.team.id}`}
            onClick={(e) => e.stopPropagation()}
            style={{ textDecoration: 'none' }}
          >
            <span className="team-badge" style={{ cursor: 'pointer' }}>{t.projects.length}</span>
          </Link>
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{formatInr(t.bgmvTotal)}</span>
          {sentimentCounts.critical > 0 && (
            <span style={{ fontSize: 10, color: 'var(--critical)' }}>{sentimentCounts.critical} critical</span>
          )}
          {sentimentCounts.attention > 0 && (
            <span style={{ fontSize: 10, color: 'var(--attention)' }}>{sentimentCounts.attention} attn</span>
          )}
          {sentimentCounts.noBrief > 0 && (
            <span style={{ fontSize: 10, color: 'var(--text-dim)', border: '1px solid var(--border-subtle)', borderRadius: 3, padding: '0 4px' }}>
              {sentimentCounts.noBrief} no brief
            </span>
          )}
        </div>
      </div>

      <div className="health-bar" style={{ marginTop: 2 }}>
        {segs.length > 0
          ? segs.map((color, i) => <div key={i} className="health-seg" style={{ background: color }} />)
          : <div className="health-seg" style={{ background: 'var(--surface-elevated)', flex: '1 1 auto' }} />
        }
      </div>

      <div className="member-pills">
        <MemberPill role="Planner"  name={t.team.planner.name}  initials={t.team.planner.initials}  roleKey="planner" />
        <MemberPill role="Designer" name={t.team.designer.name} initials={t.team.designer.initials} roleKey="designer" />
        <MemberPill role="PM"       name={t.team.pm.name}       initials={t.team.pm.initials}       roleKey="pm" />
      </div>

      {t.projects.length > 0 ? (
        <div className="team-projects-list">
          {sorted.map((p) => <TeamProjectRow key={p.pid} p={p} briefMap={briefMap} />)}
          <PastEventsToggle projects={pastProjects} briefMap={briefMap} />
        </div>
      ) : (
        <div className="team-empty">No active projects</div>
      )}
    </div>
  )
}

function OutlierRow({ p, brief }: { p: ProjectAssignment; brief: BriefSummary | undefined }) {
  const accent = rowAccentColor(brief, p.overall_pid_risk)
  const isPast = (p.t_days ?? 0) < -7
  return (
    <div
      className="team-project-row"
      style={{
        boxShadow: accent !== 'transparent' ? `inset 3px 0 0 ${accent}` : undefined,
        opacity: isPast ? 0.55 : 1,
        gap: 8,
      }}
      onClick={() => { window.location.hash = `#pid=${p.pid}` }}
    >
      <span className={`status-dot ${riskDotClass(p.overall_pid_risk)}`} />
      <span className="team-project-pid">{p.pid}</span>
      <span className="team-project-name" style={{ minWidth: 0, flex: '0 1 140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {formatCouple(p.cx_name)}
      </span>
      <MemberInline name={p.planner} />
      <MemberInline name={p.designer} />
      <MemberInline name={p.project_manager} />
      <span className="team-project-date" style={{ marginLeft: 'auto' }}>{eventLabel(p.event_start_date)}</span>
      <span className="team-project-bgmv">{formatInr(p.bgmv)}</span>
    </div>
  )
}

function SalesWipRow({ p, brief }: { p: ProjectAssignment; brief: BriefSummary | undefined }) {
  const accent = rowAccentColor(brief, p.overall_pid_risk)
  const isPast = (p.t_days ?? 0) < -7
  return (
    <div
      className="team-project-row"
      style={{
        boxShadow: accent !== 'transparent' ? `inset 3px 0 0 ${accent}` : undefined,
        opacity: isPast ? 0.55 : 1,
        gap: 8,
      }}
      onClick={() => { window.location.hash = `#pid=${p.pid}` }}
    >
      <span className={`status-dot ${riskDotClass(p.overall_pid_risk)}`} />
      <span className="team-project-pid">{p.pid}</span>
      <span className="team-project-name" style={{ minWidth: 0, flex: '0 1 160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {formatCouple(p.cx_name)}
      </span>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
        {p.rm ? `RM: ${p.rm.split(' ')[0]}` : 'RM: —'}
      </span>
      <span className="team-project-date" style={{ marginLeft: 'auto' }}>{eventLabel(p.event_start_date)}</span>
      <span className="team-project-bgmv">{formatInr(p.bgmv)}</span>
    </div>
  )
}

export function TeamView({ teams, outliers, salesWip, briefMap, filterTeamId }: Props) {
  const visibleTeams = filterTeamId ? teams.filter((t) => t.team.id === filterTeamId) : teams

  const sortedOutliers = [...outliers].sort((a, b) => sortKey(a, briefMap) - sortKey(b, briefMap))
  const sortedWip = [...salesWip].sort((a, b) => sortKey(a, briefMap) - sortKey(b, briefMap))

  return (
    <>
      {filterTeamId && (
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Filtered by {teams.find((t) => t.team.id === filterTeamId)?.team.label}
          </span>
          <Link href="/team" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}>
            · clear
          </Link>
        </div>
      )}

      <div className="team-grid">
        {visibleTeams.map((t, ti) => (
          <TeamCard key={t.team.id} t={t} briefMap={briefMap} ti={ti} />
        ))}
      </div>

      {!filterTeamId && outliers.length > 0 && (
        <div className="card card--flat" style={{ padding: 20 }}>
          <div className="section-header">
            <div className="eyebrow">Outliers · Cross-team or unmapped</div>
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
              {outliers.length} {outliers.length === 1 ? 'project' : 'projects'}
            </span>
          </div>
          <div className="team-projects-list">
            {sortedOutliers.map((p) => <OutlierRow key={p.pid} p={p} brief={briefMap.get(p.pid)} />)}
          </div>
        </div>
      )}

      {!filterTeamId && salesWip.length > 0 && (
        <div className="card card--flat" style={{ padding: 20, marginTop: 12 }}>
          <div className="section-header">
            <div className="eyebrow">Sales WIP · Planning not started</div>
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
              {salesWip.length} {salesWip.length === 1 ? 'project' : 'projects'}
            </span>
          </div>
          <div className="team-projects-list">
            {sortedWip.map((p) => <SalesWipRow key={p.pid} p={p} brief={briefMap.get(p.pid)} />)}
          </div>
        </div>
      )}
    </>
  )
}
