import { ChevronRight } from 'lucide-react'
import type { Project } from '@/lib/types/project'
import { formatCouple } from '@/lib/types/project'
import { PIDLink } from '@/components/panel/PIDLink'

type TodaysPrioritiesProps = { projects: Project[] }

function riskAccentColor(level: string | null | undefined): string {
  if (level === 'Critical') return 'var(--critical)'
  if (level === 'Attention') return 'var(--attention)'
  return 'var(--healthy)'
}

function riskLabel(level: string | null | undefined): string {
  if (level === 'Critical') return 'Critical'
  if (level === 'Attention') return 'Attention'
  return 'Healthy'
}

function peekMeta(p: Project): string {
  const parts: string[] = []
  if (p.venue) parts.push(p.venue)
  if (p.communication_days != null) parts.push(`${p.communication_days}d silent`)
  if (p.collection_pct != null) parts.push(`${p.collection_pct}% collected`)
  return parts.join(' · ')
}

function firstSentence(p: Project): string {
  if (p.current_summary) return p.current_summary.split('.')[0] ?? p.current_summary
  if (p.overall_pid_risk === 'Critical') return 'Critical risk — immediate attention needed'
  if (p.overall_pid_risk === 'Attention') return 'Attention-level risk'
  return 'Flagged for review'
}

function shortHint(p: Project): string {
  if (p.current_summary) {
    const first = p.current_summary.split('.')[0] ?? ''
    const words = first.split(' ')
    return words.slice(0, 7).join(' ') + (words.length > 7 ? '…' : '')
  }
  if (p.communication_days != null && p.communication_days > 7) return `${p.communication_days}d no comms`
  if (p.collection_pct != null) return `${p.collection_pct}% collected`
  return p.overall_pid_risk ?? ''
}

export function TodaysPriorities({ projects }: TodaysPrioritiesProps) {
  return (
    <div className="card card--flat">
      <div className="section-header">
        <div className="eyebrow">Today&apos;s Priorities</div>
        <div className="count-pill">{projects.length} items</div>
      </div>
      <div className="priorities-list">
        {projects.map((p, i) => (
          <div key={p.pid} className="priority-wrap" style={{ '--i': i } as React.CSSProperties}>
            <PIDLink pid={p.pid} className="priority-row-v2">
              <span
                className="priority-accent"
                style={{ background: riskAccentColor(p.overall_pid_risk) }}
                aria-hidden
              />
              <span className="priority-main">
                <span className="priority-name">{formatCouple(p.cx_name)}</span>
              </span>
              <span className="priority-hint">{shortHint(p)}</span>
              <span
                className={`health-chip ${(p.overall_pid_risk ?? 'healthy').toLowerCase()}`}
                style={{ fontSize: 10, padding: '2px 8px', flexShrink: 0 }}
              >
                {riskLabel(p.overall_pid_risk)}
              </span>
              <ChevronRight style={{ width: 13, height: 13, color: 'var(--text-dim)', flexShrink: 0 }} />
            </PIDLink>
            {(p.current_summary || p.venue || p.communication_days != null) && (
              <div className="peek-panel" role="tooltip">
                {peekMeta(p) && <div className="peek-meta">{peekMeta(p)}</div>}
                {p.current_summary && <div className="peek-summary">{firstSentence(p)}</div>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
