'use client'

import { formatCouple, formatInr, riskDotClass } from '@/lib/types/project'
import type { ProjectAssignment, TeamGroup, TeamProject } from '@/lib/static/teams_static'

type Props = {
  teams: TeamGroup[]
  outliers: ProjectAssignment[]
}

function eventLabel(date: string | null): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
}

function riskAccentColor(level: string | null): string {
  if (level === 'Critical') return 'var(--critical)'
  if (level === 'Attention') return 'var(--attention)'
  return 'transparent'
}

function MemberPill({ role, name, initials, color }: { role: string; name: string | null; initials: string; color: string }) {
  const empty = !name
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

function ProjectRow({ p }: { p: TeamProject | ProjectAssignment }) {
  const isPartial = 'coverage' in p && (p as TeamProject).coverage === 'partial'
  const riskColor = riskAccentColor(p.overall_pid_risk)
  return (
    <div
      className="team-project-row"
      style={{ boxShadow: riskColor !== 'transparent' ? `inset 3px 0 0 ${riskColor}` : undefined }}
      onClick={() => { window.location.hash = `#pid=${p.pid}` }}
    >
      <span className={`status-dot ${riskDotClass(p.overall_pid_risk)}`} />
      <span className="team-project-pid">{p.pid}</span>
      <span className="team-project-name">{formatCouple(p.cx_name)}</span>
      {isPartial && <span className="silent-chip">MIXED</span>}
      <span className="team-project-date">{eventLabel(p.event_start_date)}</span>
      <span className="team-project-bgmv">{formatInr(p.bgmv)}</span>
    </div>
  )
}

function OutlierRow({ p }: { p: ProjectAssignment }) {
  const riskColor = riskAccentColor(p.overall_pid_risk)
  const members = [
    p.planner && `${p.planner.split(' ')[0]}`,
    p.designer && `${p.designer.split(' ')[0]}`,
    p.project_manager && `${p.project_manager.split(' ')[0]}`,
  ].filter(Boolean).join(' · ')
  return (
    <div
      className="team-project-row"
      style={{ boxShadow: riskColor !== 'transparent' ? `inset 3px 0 0 ${riskColor}` : undefined, height: 'auto', padding: '8px 8px' }}
      onClick={() => { window.location.hash = `#pid=${p.pid}` }}
    >
      <span className={`status-dot ${riskDotClass(p.overall_pid_risk)}`} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="team-project-pid">{p.pid}</span>
          <span className="team-project-name">{formatCouple(p.cx_name)}</span>
        </div>
        {members && (
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>{members}</div>
        )}
      </div>
      <span className="team-project-date">{eventLabel(p.event_start_date)}</span>
      <span className="team-project-bgmv">{formatInr(p.bgmv)}</span>
    </div>
  )
}

export function TeamView({ teams, outliers }: Props) {
  return (
    <>
      <div className="team-grid">
        {teams.map((t, ti) => {
          const segs = t.projects.slice(0, 10).map((p) => {
            const r = p.overall_pid_risk
            return r === 'Critical' ? 'var(--critical)' : r === 'Attention' ? 'var(--attention)' : 'var(--healthy)'
          })

          return (
            <div key={t.team.id} className={`card card--flat team-card stagger-${(ti % 4) + 1}`}>
              <div className="team-card-header">
                <div className="team-card-name">{t.team.label}</div>
                <div className="team-card-meta">
                  <span className="team-badge">{t.projects.length}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{formatInr(t.bgmvTotal)}</span>
                </div>
              </div>

              {/* Per-project health segments (like dashboard widget) */}
              <div className="health-bar" style={{ marginTop: 2 }}>
                {segs.length > 0
                  ? segs.map((color, i) => (
                      <div key={i} className="health-seg" style={{ background: color }} />
                    ))
                  : <div className="health-seg" style={{ background: 'var(--surface-elevated)', flex: '1 1 auto' }} />
                }
              </div>

              <div className="member-pills">
                <MemberPill role="Planner" name={t.team.planner.name} initials={t.team.planner.initials} color={t.team.planner.color} />
                <MemberPill role="Designer" name={t.team.designer.name} initials={t.team.designer.initials} color={t.team.designer.color} />
                <MemberPill role="PM" name={t.team.pm.name} initials={t.team.pm.initials} color={t.team.pm.color} />
              </div>

              {t.projects.length > 0 ? (
                <div className="team-projects-list">
                  {t.projects.map((p) => <ProjectRow key={p.pid} p={p} />)}
                </div>
              ) : (
                <div className="team-empty">No active projects</div>
              )}
            </div>
          )
        })}
      </div>

      {outliers.length > 0 && (
        <div className="card card--flat" style={{ padding: 20 }}>
          <div className="section-header">
            <div className="eyebrow">Outliers · Cross-team or unmapped</div>
            <span style={{ fontSize: 11, color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' }}>
              {outliers.length} {outliers.length === 1 ? 'project' : 'projects'}
            </span>
          </div>
          <div className="team-projects-list">
            {outliers.map((p) => <OutlierRow key={p.pid} p={p} />)}
          </div>
        </div>
      )}
    </>
  )
}
