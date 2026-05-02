import type { Project } from '@/lib/types/project'
import { formatCouple, riskDotClass } from '@/lib/types/project'
import { PIDLink } from '@/components/panel/PIDLink'

type ActivityFeedProps = { projects: Project[] }

function relativeDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return '1d ago'
  return `${days}d ago`
}

function activityText(p: Project): string {
  if (p.current_summary) {
    const sentence = p.current_summary.split('.')[0] ?? p.current_summary
    return sentence.length > 90 ? sentence.slice(0, 87) + '…' : sentence
  }
  return `Last contact with ${formatCouple(p.cx_name)}`
}

export function ActivityFeed({ projects }: ActivityFeedProps) {
  if (projects.length === 0) return null
  return (
    <div className="card card--flat fade-in" style={{ animationDelay: '600ms' }}>
      <div className="section-header">
        <div className="eyebrow">Recent Activity</div>
        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>synced data</span>
      </div>
      {projects.map((p) => (
        <PIDLink key={p.pid} pid={p.pid} className="activity-row">
          <span className="activity-time">{relativeDate(p.last_message_date)}</span>
          <span className={`status-dot ${riskDotClass(p.overall_pid_risk)}`} style={{ flexShrink: 0 }} />
          <span className="activity-desc">{activityText(p)}</span>
          <div className="pid-badge">{p.pid}</div>
        </PIDLink>
      ))}
    </div>
  )
}
