'use client'

import { formatCouple, formatInr } from '@/lib/types/project'
import { TEAMS } from '@/lib/static/teams_static'

type Row = {
  pid: number
  cx_name: string | null
  status: string | null
  planner: string | null
  designer: string | null
  project_manager: string | null
  event_start_date: string | null
  overall_pid_risk: string | null
  cancellation_risk: number | null
  collection_pct: number | null
  bgmv: number | null
  region: string | null
  state: string | null
  city: string | null
}

// Build name → color map from static team config
const MEMBER_COLORS: Record<string, string> = {}
for (const t of TEAMS) {
  if (t.planner.name) MEMBER_COLORS[t.planner.name] = t.planner.color
  if (t.designer.name) MEMBER_COLORS[t.designer.name] = t.designer.color
  if (t.pm.name) MEMBER_COLORS[t.pm.name] = t.pm.color
}
// Fallback palette for unknown members
const FALLBACK = ['#7241BE', '#EC4899', '#14B8A6', '#F59E0B', '#3B82F6', '#10B981', '#F97316']
function memberColor(name: string | null): string {
  if (!name) return '#A09890'
  if (MEMBER_COLORS[name]) return MEMBER_COLORS[name]
  const code = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return FALLBACK[code % FALLBACK.length]
}

function initials(name: string | null): string {
  if (!name) return '?'
  return name.split(' ').slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('')
}

// Normalise whatever the DB sends into Critical/Attention/Healthy/null
function normaliseRisk(raw: string | null): 'Critical' | 'Attention' | 'Healthy' | null {
  if (!raw) return null
  const l = raw.toLowerCase()
  if (l === 'critical' || l.includes('critical')) return 'Critical'
  if (l === 'healthy' || l === 'low' || l === 'none' || l === 'green') return 'Healthy'
  // "Attention", "Risk", "Communication Risk", "Collection Risk", etc.
  return 'Attention'
}

function riskAccent(level: ReturnType<typeof normaliseRisk>): string {
  if (level === 'Critical') return 'var(--critical)'
  if (level === 'Attention') return 'var(--attention)'
  if (level === 'Healthy') return 'var(--healthy)'
  return 'var(--border-subtle)'
}

function RiskHealthCell({ risk, cancelRisk }: { risk: string | null; cancelRisk: number | null }) {
  const level = normaliseRisk(risk)
  const val = cancelRisk ?? 0
  const color = level === 'Critical' ? 'var(--critical)' : level === 'Attention' ? 'var(--attention)' : level === 'Healthy' ? 'var(--healthy)' : 'var(--text-dim)'
  const label = level ?? (risk ?? '—')

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <div className="health-dots" aria-label={label} title={label}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="health-dot" style={{
            background: i <= val ? color : 'var(--border-default)',
            opacity: i <= val ? 1 : 0.28,
          }} />
        ))}
      </div>
    </div>
  )
}

function CollectCell({ pct }: { pct: number | null }) {
  if (pct == null) return <span style={{ color: 'var(--text-dim)' }}>—</span>
  const color = pct >= 60 ? 'var(--healthy)' : pct >= 30 ? 'var(--attention)' : 'var(--critical)'
  return (
    <div className="collect-bar-wrap">
      <span className="collect-pct" style={{ color }}>{pct.toFixed(0)}%</span>
      <div className="collect-bar">
        <div className="collect-bar-fill" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
      </div>
    </div>
  )
}

function eventCell(dateStr: string | null) {
  if (!dateStr) return <span style={{ color: 'var(--text-dim)' }}>—</span>
  const date = new Date(dateStr)
  const days = Math.ceil((date.getTime() - Date.now()) / 86400000)
  const label = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
  const color = days < 0 ? 'var(--text-dim)' : days < 30 ? 'var(--critical)' : days < 90 ? 'var(--attention)' : 'var(--text-muted)'
  return (
    <span style={{ color, fontFamily: 'var(--font-mono)', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
      {label}
      {days >= 0 && days < 90 && (
        <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.75 }}>({days}d)</span>
      )}
    </span>
  )
}

function MemberCell({ name }: { name: string | null }) {
  if (!name) return <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>—</span>
  const color = memberColor(name)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{
        width: 22, height: 22, borderRadius: '50%',
        background: `${color}22`,
        color,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 9, fontWeight: 700, flexShrink: 0,
        border: `1px solid ${color}44`,
      }}>
        {initials(name)}
      </span>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
        {name.split(' ')[0]}
      </span>
    </span>
  )
}

function stripDestinationSuffix(loc: string | null | undefined): string {
  if (!loc) return '—'
  return loc.replace(/\s*\(D\)\s*$/i, '').trim() || '—'
}

export function ProjectsTable({ projects }: { projects: Row[] }) {
  return (
    <div className="projects-table-wrap">
      <table className="projects-table">
        <thead>
          <tr>
            <th style={{ width: 4, padding: 0 }} />
            <th>PID</th>
            <th>Couple</th>
            <th>Location</th>
            <th>Planner</th>
            <th>Designer</th>
            <th>PM</th>
            <th>Event</th>
            <th>Risk · Health</th>
            <th>Collected</th>
            <th style={{ textAlign: 'right' }}>BGMV</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => {
            const level = normaliseRisk(p.overall_pid_risk)
            return (
              <tr key={p.pid} onClick={() => { window.location.hash = `#pid=${p.pid}` }}>
                <td style={{ padding: 0, width: 4, boxShadow: `inset 3px 0 0 ${riskAccent(level)}` }} />
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', paddingLeft: 14 }}>
                  {p.pid}
                </td>
                <td style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13, maxWidth: 160, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {formatCouple(p.cx_name)}
                </td>
                <td style={{ fontSize: 12 }}>{stripDestinationSuffix(p.state ?? p.city)}</td>
                <td><MemberCell name={p.planner} /></td>
                <td><MemberCell name={p.designer} /></td>
                <td><MemberCell name={p.project_manager} /></td>
                <td>{eventCell(p.event_start_date)}</td>
                <td><RiskHealthCell risk={p.overall_pid_risk} cancelRisk={p.cancellation_risk} /></td>
                <td><CollectCell pct={p.collection_pct} /></td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)', paddingRight: 20 }}>
                  {formatInr(p.bgmv)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
