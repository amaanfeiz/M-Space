import type { Project } from '@/lib/types/project'
import { formatCouple } from '@/lib/types/project'
import { PIDLink } from '@/components/panel/PIDLink'

type RiskMonitorProps = {
  projects: Project[]
}

function meterColor(risk: number | null, level: string | null): string {
  if (level === 'Critical' || (risk ?? 0) >= 4) return 'var(--critical)'
  if (level === 'Attention' || (risk ?? 0) >= 2) return 'var(--attention)'
  return 'var(--healthy)'
}

function trackBg(level: string | null): string {
  if (level === 'Critical') return 'rgba(220,38,38,0.12)'
  if (level === 'Attention') return 'rgba(202,138,4,0.12)'
  return 'rgba(22,163,74,0.12)'
}

export function RiskMonitor({ projects }: RiskMonitorProps) {
  return (
    <div className="card" style={{ padding: 24 }}>
      <div className="section-header">
        <div className="eyebrow">Risk Monitor</div>
        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
          cancellation risk
        </span>
      </div>
      {projects.map((p) => {
        const risk = p.cancellation_risk ?? 0
        const pct = Math.min(100, Math.max(0, (risk / 5) * 100))
        const color = meterColor(p.cancellation_risk, p.overall_pid_risk)
        const bg = trackBg(p.overall_pid_risk)
        return (
          <PIDLink key={p.pid} pid={p.pid} className="risk-row">
            <span className="risk-pid">{p.pid}</span>
            <span className="risk-couple">{formatCouple(p.cx_name)}</span>
            <div
              style={{
                width: 80,
                flexShrink: 0,
                height: 6,
                borderRadius: 3,
                background: bg,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: color,
                  borderRadius: 3,
                  transition: 'width 300ms ease-out',
                }}
              />
            </div>
            <span
              className="risk-score"
              style={{ color, fontWeight: 600 }}
            >
              {risk}/5
            </span>
          </PIDLink>
        )
      })}
    </div>
  )
}
