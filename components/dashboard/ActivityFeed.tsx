import type { Project } from '@/lib/types/project'
import { formatCouple } from '@/lib/types/project'

type ActivityFeedProps = {
  projects: Project[]
}

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
    return sentence.length > 100 ? sentence.slice(0, 97) + '…' : sentence
  }
  return `Last contact with ${formatCouple(p.cx_name)}`
}

export function ActivityFeed({ projects }: ActivityFeedProps) {
  if (projects.length === 0) return null

  return (
    <div className="card fade-in" style={{ animationDelay: '600ms' }}>
      <div className="section-header">
        <div className="eyebrow">Recent Activity</div>
        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
          synced data
        </span>
      </div>
      {projects.map((p) => (
        <div key={p.pid} className="activity-row">
          <span className="activity-time">
            {relativeDate(p.last_message_date)}
          </span>
          <div
            className="activity-icon"
            style={{ background: 'rgba(114,65,190,0.10)' }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <span className="activity-desc">{activityText(p)}</span>
          <div className="pid-badge">{p.pid}</div>
        </div>
      ))}
    </div>
  )
}
