'use client'

import { useState } from 'react'
import type { Project } from '@/lib/types/project'
import { formatCouple } from '@/lib/types/project'
import { PIDLink } from '@/components/panel/PIDLink'

type StalledProjectsProps = {
  projects: Project[]
}

export function StalledProjects({ projects }: StalledProjectsProps) {
  const [threshold, setThreshold] = useState(14)

  const filtered = projects
    .filter((p) => (p.communication_days ?? 0) > threshold)
    .sort((a, b) => (b.communication_days ?? 0) - (a.communication_days ?? 0))
    .slice(0, 5)

  if (filtered.length === 0) return null

  const total = projects.filter((p) => (p.communication_days ?? 0) > threshold).length

  return (
    <div className="stalled-section fade-in" style={{ animationDelay: '120ms' }}>
      <div
        style={{
          fontSize: 11, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase',
          color: 'var(--text-dim)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8,
        }}
      >
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--attention)' }} />
        Stalled Projects
        <select
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
          style={{ fontSize: 10, background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', padding: '2px 4px', borderRadius: 3, marginLeft: 4 }}
        >
          <option value={7}>7d+</option>
          <option value={14}>14d+</option>
          <option value={21}>21d+</option>
          <option value={30}>30d+</option>
        </select>
      </div>
      {filtered.map((p) => (
        <PIDLink key={p.pid} pid={p.pid} className="stalled-card" style={{ cursor: 'pointer' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--attention)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: 'var(--text-dim)' }}>
                {p.pid}
              </span>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                {formatCouple(p.cx_name)}
              </span>
              <span className="silent-chip">{p.communication_days}d silent</span>
              {p.planner && (
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>· {p.planner.split(' ')[0]}</span>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {[p.venue, p.state].filter(Boolean).join(', ')}
              {p.event_start_date
                ? `. ${new Date(p.event_start_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}.`
                : '.'}
            </div>
          </div>
        </PIDLink>
      ))}
      {total > 5 && (
        <div style={{ fontSize: 11, color: 'var(--text-dim)', paddingTop: 6 }}>
          +{total - 5} more
        </div>
      )}
    </div>
  )
}
