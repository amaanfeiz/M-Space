import type { Project } from '@/lib/types/project'
import { formatCouple } from '@/lib/types/project'

type StalledProjectsProps = {
  projects: Project[]
}

export function StalledProjects({ projects }: StalledProjectsProps) {
  if (projects.length === 0) return null

  return (
    <div className="stalled-section fade-in" style={{ animationDelay: '120ms' }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--text-dim)',
          marginBottom: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <div
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: 'var(--attention)',
          }}
        />
        Stalled Projects · No team contact {'>'}14 days
      </div>
      {projects.map((p) => (
        <div key={p.pid} className="stalled-card">
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--attention)',
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  fontFamily: "'Courier New', monospace",
                  fontSize: 11,
                  color: 'var(--text-dim)',
                }}
              >
                {p.pid}
              </span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                }}
              >
                {formatCouple(p.cx_name)}
              </span>
              <span className="silent-chip">
                {p.communication_days}d silent
              </span>
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'var(--text-muted)',
                marginTop: 2,
              }}
            >
              {[p.venue, p.state].filter(Boolean).join(', ')}
              {p.event_start_date
                ? `. ${new Date(p.event_start_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}.`
                : '.'}
              {p.communication_days
                ? ` No team contact in ${p.communication_days} days.`
                : ''}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
