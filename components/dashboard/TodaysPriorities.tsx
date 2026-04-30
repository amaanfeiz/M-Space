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
          <div className="priority-left">
            <span className={`status-dot ${riskDotClass(p.overall_pid_risk)}`} />
            <span className="pid-text">{p.pid}</span>
            <span className="couple-name">{formatCouple(p.cx_name)}</span>
          </div>
          <div className="priority-right">
            <span>{prioritySummary(p)}</span>
            <ChevronRight style={{ width: 13, height: 13 }} />
          </div>
        </PIDLink>
      ))}
    </div>
  )
}
