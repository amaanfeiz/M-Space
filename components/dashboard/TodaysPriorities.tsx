import { ChevronRight } from 'lucide-react'
import type { Project } from '@/lib/types/project'
import { formatCouple, riskDotClass } from '@/lib/types/project'
import { PIDLink } from '@/components/panel/PIDLink'

type TodaysPrioritiesProps = {
  projects: Project[]
}

function prioritySummary(p: Project): string {
  if (p.current_summary) {
    return p.current_summary.split('.')[0] ?? p.current_summary
  }
  if (p.overall_pid_risk === 'Critical') return 'Critical risk — immediate attention needed'
  if (p.overall_pid_risk === 'Attention') return 'Attention-level risk'
  return 'Flagged for review'
}

export function TodaysPriorities({ projects }: TodaysPrioritiesProps) {
  return (
    <div className="card" style={{ padding: 24 }}>
      <div className="section-header">
        <div className="eyebrow">Today&apos;s Priorities</div>
        <div className="count-pill">{projects.length} items</div>
      </div>
      {projects.map((p) => (
        <PIDLink key={p.pid} pid={p.pid} className="priority-row">
          <span
            className={`status-dot ${riskDotClass(p.overall_pid_risk)}`}
            style={{ flexShrink: 0 }}
          />
          <span className="pid-text" style={{ flexShrink: 0 }}>
            {p.pid}
          </span>
          <span
            className="couple-name"
            style={{
              flexShrink: 0,
              maxWidth: 140,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {formatCouple(p.cx_name)}
          </span>
          <span
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 13,
              color: 'var(--text-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              textAlign: 'right',
            }}
          >
            {prioritySummary(p)}
          </span>
          <ChevronRight
            style={{ width: 13, height: 13, color: 'var(--text-dim)', flexShrink: 0 }}
          />
        </PIDLink>
      ))}
    </div>
  )
}
