import type { Project } from '@/lib/types/project'
import { formatCouple } from '@/lib/types/project'

type WhatChangedProps = {
  projects: Project[]
  syncedAt: string | null
}

function syncLabel(syncedAt: string | null): string {
  if (!syncedAt) return 'Last sync: unknown'
  const diff = Date.now() - new Date(syncedAt).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 2) return 'Last sync: just now'
  if (mins < 60) return `Last sync: ${mins}m ago`
  const hrs = Math.floor(mins / 60)
  return `Last sync: ${hrs}h ago`
}

function excerpt(summary: string | null): string {
  if (!summary) return 'No summary available.'
  const sentence = summary.split('.')[0] ?? summary
  return sentence.length > 120 ? sentence.slice(0, 117) + '…' : sentence
}

export function WhatChanged({ projects, syncedAt }: WhatChangedProps) {
  if (projects.length === 0) return null

  return (
    <div className="changed-strip fade-in" style={{ animationDelay: '80ms' }}>
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
          justifyContent: 'space-between',
        }}
      >
        <span>What Changed · {syncLabel(syncedAt)}</span>
        <span style={{ fontSize: 10 }}>synced data</span>
      </div>
      {projects.map((p) => (
        <div key={p.pid} className="changed-row">
          <div className="changed-time">
            {p.synced_at
              ? new Date(p.synced_at).toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '—'}
          </div>
          <div className="changed-pid">{p.pid}</div>
          <div className="changed-event">
            {formatCouple(p.cx_name)} — {excerpt(p.current_summary)}
          </div>
        </div>
      ))}
    </div>
  )
}
