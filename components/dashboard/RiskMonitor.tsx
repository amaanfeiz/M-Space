import type { Project } from '@/lib/types/project'
import {
  flatSparkline,
  formatCouple,
  sparklineColor,
} from '@/lib/types/project'
import { PIDLink } from '@/components/panel/PIDLink'

type RiskMonitorProps = {
  projects: Project[]
}

function riskLabel(risk: number | null): string {
  if (!risk) return '—'
  return `${risk}/5`
}

function riskLabelColor(riskLevel: string | null): string {
  if (riskLevel === 'Critical') return 'var(--critical)'
  if (riskLevel === 'Attention') return 'var(--attention)'
  return 'var(--healthy)'
}

export function RiskMonitor({ projects }: RiskMonitorProps) {
  return (
    <div className="card" style={{ padding: 24 }}>
      <div className="section-header">
        <div className="eyebrow">Risk Monitor</div>
        <span
          style={{
            fontSize: 10,
            color: 'var(--text-dim)',
          }}
        >
          synced data
        </span>
      </div>
      {projects.map((p) => {
        const points = flatSparkline(p.cancellation_risk)
        const color = sparklineColor(p.overall_pid_risk)
        return (
          <PIDLink key={p.pid} pid={p.pid} className="risk-row">
            <span className="risk-pid">{p.pid}</span>
            <span className="risk-couple">{formatCouple(p.cx_name)}</span>
            <div className="sparkline-wrap">
              <svg viewBox="0 0 60 18" width="60" height="18">
                <polyline
                  points={points}
                  fill="none"
                  stroke={color}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span
              className="risk-score"
              style={{ color: riskLabelColor(p.overall_pid_risk) }}
            >
              {riskLabel(p.cancellation_risk)}
            </span>
          </PIDLink>
        )
      })}
    </div>
  )
}
