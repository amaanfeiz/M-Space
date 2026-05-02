import type { Project } from '@/lib/types/project'
import { formatCouple } from '@/lib/types/project'
import { PIDLink } from '@/components/panel/PIDLink'

type RiskMonitorProps = { projects: Project[] }

function healthColor(pct: number): string {
  if (pct < 40) return 'var(--critical)'
  if (pct < 70) return 'var(--attention)'
  return 'var(--healthy)'
}

function riskProfile(p: Project): number[] {
  const healthVal  = p.project_health ?? 3
  const cancelVal  = p.cancellation_risk ?? 0
  const commsVal   = Math.min(5, Math.floor((p.communication_days ?? 0) / 7))
  const collectVal = p.collection_pct != null
    ? p.collection_pct < 20 ? 4 : p.collection_pct < 40 ? 3 : p.collection_pct < 70 ? 1 : 0
    : 2
  // Build 5-point health profile (higher = healthier on chart)
  return [
    healthVal,
    5 - commsVal,
    5 - cancelVal,
    5 - collectVal,
    healthVal,
  ]
}

function Sparkline({ points, color }: { points: number[]; color: string }) {
  const W = 72, H = 28, pad = 3
  const n = points.length
  const xs = points.map((_, i) => pad + (i / (n - 1)) * (W - pad * 2))
  const ys = points.map((v) => H - pad - (Math.min(Math.max(v, 0), 5) / 5) * (H - pad * 2))
  const line = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')
  const area = `${line} L${xs[n-1].toFixed(1)},${H} L${xs[0].toFixed(1)},${H} Z`
  const id = `sp${points.reduce((a, v) => a + v, 0).toFixed(0)}`
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ flexShrink: 0, display: 'block' }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={xs[n-1].toFixed(1)} cy={ys[n-1].toFixed(1)} r="2.5" fill={color} />
    </svg>
  )
}

export function RiskMonitor({ projects }: RiskMonitorProps) {
  return (
    <div className="card card--flat">
      <div className="section-header">
        <div className="eyebrow">Risk Monitor</div>
        <span className="live-pill">
          <span className="pulse-dot" />
          health
        </span>
      </div>
      {projects.map((p, i) => {
        const pct = Math.round(((p.project_health ?? 3) / 5) * 100)
        const color = healthColor(pct)
        const profile = riskProfile(p)
        return (
          <PIDLink key={p.pid} pid={p.pid} className="risk-row" style={{ '--i': i } as React.CSSProperties}>
            <span className="risk-pid">{p.pid}</span>
            <span className="risk-couple">{formatCouple(p.cx_name)}</span>
            <Sparkline points={profile} color={color} />
            <span className="risk-score" style={{ color, fontWeight: 700, minWidth: 36, textAlign: 'right' }}>{pct}%</span>
          </PIDLink>
        )
      })}
    </div>
  )
}
