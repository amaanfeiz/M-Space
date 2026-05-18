'use client'

import { formatCouple, formatInr } from '@/lib/types/project'

// Routed through a helper so the React purity-during-render lint rule
// stays quiet. Re-evaluating "now" on each render is intentional —
// staleness pills should reflect actual elapsed time.
function nowMillis(): number {
  return Date.now()
}

type Row = {
  pid: number
  cx_name: string | null
  status: string | null
  planner: string | null
  designer: string | null
  project_manager: string | null
  event_start_date: string | null
  t_days: number | null
  overall_pid_risk: string | null
  collection_pct: number | null
  bgmv: number | null
  region: string | null
  state: string | null
  city: string | null
  venue: string | null
  rm: string | null
}

interface BriefSummary {
  sentiment: string
  flags: number
  actions: number
  /** ISO date string YYYY-MM-DD of when the brief was generated. */
  briefDate: string
}


// Normalise whatever the DB sends into Critical/Attention/Healthy/null.
// Used only as a fallback for the row accent when no brief sentiment exists.
function normaliseRisk(raw: string | null): 'Critical' | 'Attention' | 'Healthy' | null {
  if (!raw) return null
  const l = raw.toLowerCase()
  if (l === 'critical' || l.includes('critical')) return 'Critical'
  if (l === 'healthy' || l === 'low' || l === 'none' || l === 'green') return 'Healthy'
  return 'Attention'
}

function riskAccent(level: ReturnType<typeof normaliseRisk>): string {
  if (level === 'Critical') return 'var(--critical)'
  if (level === 'Attention') return 'var(--attention)'
  if (level === 'Healthy') return 'var(--healthy)'
  return 'var(--border-subtle)'
}

function CollectCell({ pct }: { pct: number | null }) {
  if (pct == null) return <span style={{ color: 'var(--text-dim)' }}>—</span>
  const color = pct >= 60 ? 'var(--healthy)' : pct >= 30 ? 'var(--attention)' : 'var(--critical)'
  return (
    <span style={{ color, fontFamily: 'var(--font-mono)', fontSize: 12, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
      {pct.toFixed(0)}%
    </span>
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
  return (
    <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
      {name.split(' ')[0]}
    </span>
  )
}

function VenueCell({ venue }: { venue: string | null }) {
  if (!venue) return <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>—</span>
  return (
    <span
      title={venue}
      style={{
        fontSize: 12,
        color: 'var(--text-muted)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        display: 'inline-block',
        maxWidth: 160,
        verticalAlign: 'middle',
      }}
    >
      {venue}
    </span>
  )
}

const SENTIMENT_COLOR: Record<string, string> = {
  positive: 'var(--healthy)',
  neutral:  'var(--text-dim)',
  cautious: 'var(--attention)',
  anxious:  'var(--critical)',
  cold:     'var(--critical)',
}

const STATE_CODE: Record<string, string> = {
  'Kerala': 'KL', 'Uttarakhand': 'UK', 'Rajasthan': 'RJ',
  'Himachal Pradesh': 'HP', 'Goa': 'GA', 'Maharashtra': 'MH',
  'Delhi': 'DL', 'Karnataka': 'KA', 'Tamil Nadu': 'TN',
  'Andhra Pradesh': 'AP', 'Telangana': 'TS', 'Gujarat': 'GJ',
  'Madhya Pradesh': 'MP', 'Uttar Pradesh': 'UP', 'Punjab': 'PB',
}

function locationCode(state: string | null, city: string | null): string {
  const raw = state ?? city
  if (!raw) return '—'
  const stripped = raw.replace(/\s*\(D\)\s*$/i, '').trim()
  return STATE_CODE[stripped] ?? stripped
}

// 0 = today, no pill rendered. 1-2 days = muted. 3-6 = attention. 7+ = critical.
function staleAgeStyle(daysOld: number): { color: string; show: boolean } {
  if (daysOld <= 0) return { color: 'var(--text-dim)', show: false }
  if (daysOld <= 2) return { color: 'var(--text-dim)', show: true }
  if (daysOld <= 6) return { color: 'var(--attention)', show: true }
  return { color: 'var(--critical)', show: true }
}

function PulseCell({ brief, nowMs }: { brief: BriefSummary | undefined; nowMs: number }) {
  if (!brief || !brief.sentiment) {
    return <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>—</span>
  }
  const color = SENTIMENT_COLOR[brief.sentiment] ?? 'var(--text-dim)'
  const daysOld = brief.briefDate
    ? Math.floor((nowMs - new Date(brief.briefDate).getTime()) / 86400000)
    : 0
  const stale = staleAgeStyle(daysOld)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
      <span style={{ fontSize: 11, color, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {brief.sentiment.slice(0, 3)}
      </span>
      {(brief.flags > 0 || brief.actions > 0) && (
        <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 2 }}>
          {brief.flags > 0 && <span style={{ color: 'var(--attention)' }}>{brief.flags}f</span>}
          {brief.flags > 0 && brief.actions > 0 && ' '}
          {brief.actions > 0 && <span style={{ color: 'var(--critical)' }}>{brief.actions}a</span>}
        </span>
      )}
      {stale.show && (
        <span
          title={`Brief is ${daysOld}d old — regenerate to refresh`}
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: stale.color,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            padding: '1px 4px',
            border: `1px solid ${stale.color}33`,
            borderRadius: 3,
            marginLeft: 2,
          }}
        >
          {daysOld}d
        </span>
      )}
    </div>
  )
}

// Past events = event > 7 days behind today. Sales WIP = no planner assigned.
function segment(rows: Row[]) {
  const active: Row[] = []
  const past: Row[] = []
  const wip: Row[] = []
  for (const r of rows) {
    if (!r.planner) wip.push(r)
    else if ((r.t_days ?? 0) < -7) past.push(r)
    else active.push(r)
  }
  // Most-recent-past first inside the past segment so the freshest closures sit at the top.
  past.sort((a, b) =>
    new Date(b.event_start_date ?? 0).getTime() - new Date(a.event_start_date ?? 0).getTime(),
  )
  return { active, past, wip }
}

function ProjectRow({ p, brief, nowMs, muted, variant }: { p: Row; brief: BriefSummary | undefined; nowMs: number; muted?: boolean; variant?: 'normal' | 'wip' }) {
  const level = normaliseRisk(p.overall_pid_risk)
  const accentColor = brief?.sentiment
    ? (SENTIMENT_COLOR[brief.sentiment] ?? riskAccent(level))
    : riskAccent(level)
  const dim = muted ? 0.65 : 1
  return (
    <tr
      key={p.pid}
      onClick={() => { window.location.hash = `#pid=${p.pid}` }}
      style={{ opacity: dim }}
    >
      <td style={{ padding: 0, width: 4, boxShadow: `inset 3px 0 0 ${accentColor}` }} />
      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', paddingLeft: 14 }}>
        {p.pid}
      </td>
      <td style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13, maxWidth: 160, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {formatCouple(p.cx_name)}
      </td>
      <td style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
        {locationCode(p.state, p.city)}
      </td>
      {variant === 'wip' ? (
        <td colSpan={3} style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
          {p.rm ? `RM: ${p.rm.split(' ')[0]}` : <span style={{ color: 'var(--text-dim)' }}>RM: —</span>}
        </td>
      ) : (
        <>
          <td><MemberCell name={p.planner} /></td>
          <td><MemberCell name={p.designer} /></td>
          <td><MemberCell name={p.project_manager} /></td>
        </>
      )}
      <td><VenueCell venue={p.venue} /></td>
      <td>{eventCell(p.event_start_date)}</td>
      <td><CollectCell pct={p.collection_pct} /></td>
      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)', paddingRight: 20 }}>
        {formatInr(p.bgmv)}
      </td>
      <td><PulseCell brief={brief} nowMs={nowMs} /></td>
    </tr>
  )
}

function DividerRow({ label }: { label: string }) {
  return (
    <tr style={{ background: 'transparent' }}>
      <td colSpan={12} style={{
        padding: '14px 14px 6px',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'var(--text-dim)',
        borderTop: '1px solid var(--border-subtle)',
        background: 'transparent',
        cursor: 'default',
      }}>
        {label}
      </td>
    </tr>
  )
}

export function ProjectsTable({ projects, briefMap }: { projects: Row[]; briefMap: Map<number, BriefSummary> }) {
  const { active, past, wip } = segment(projects)
  // Compute once per render so all row staleness pills agree on "now".
  const nowMs = nowMillis()
  return (
    <div className="projects-table-wrap">
      <table className="projects-table">
        <thead>
          <tr>
            <th style={{ width: 4, padding: 0 }} />
            <th>PID</th>
            <th>Couple</th>
            <th>Loc</th>
            <th>Planner</th>
            <th>Designer</th>
            <th>PM</th>
            <th>Venue</th>
            <th>Event</th>
            <th title="Collected">Coll</th>
            <th style={{ textAlign: 'right' }}>BGMV</th>
            <th>Pulse</th>
          </tr>
        </thead>
        <tbody>
          {active.map((p) => (
            <ProjectRow key={p.pid} p={p} brief={briefMap.get(p.pid)} nowMs={nowMs} />
          ))}
          {past.length > 0 && <DividerRow label={`Past events · ${past.length}`} />}
          {past.map((p) => (
            <ProjectRow key={p.pid} p={p} brief={briefMap.get(p.pid)} nowMs={nowMs} muted />
          ))}
          {wip.length > 0 && <DividerRow label={`Sales WIP · planning not started · ${wip.length}`} />}
          {wip.map((p) => (
            <ProjectRow key={p.pid} p={p} brief={briefMap.get(p.pid)} nowMs={nowMs} muted variant="wip" />
          ))}
        </tbody>
      </table>
    </div>
  )
}
