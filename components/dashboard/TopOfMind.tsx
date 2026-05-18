'use client'

import { useState } from 'react'

export type UrgentPid = {
  pid: number
  cxName: string | null
  sentiment: string
  daysSilent: number
  items: Array<{ kind: 'needs_you' | 'unanswered'; text: string; meta?: string }>
}

const SENTIMENT_COLOR: Record<string, string> = {
  cold: 'var(--critical)',
  anxious: 'var(--critical)',
  cautious: 'var(--attention)',
  neutral: 'var(--text-dim)',
  positive: 'var(--healthy)',
}

function TopOfMindRow({ pid, expanded, onToggle }: { pid: UrgentPid; expanded: boolean; onToggle: () => void }) {
  const sentColor = SENTIMENT_COLOR[pid.sentiment] ?? 'var(--text-dim)'
  return (
    <div>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}
        onClick={() => { window.location.hash = `#pid=${pid.pid}` }}
      >
        <button
          onClick={(e) => { e.stopPropagation(); onToggle() }}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 0, width: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9 }}
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? '▼' : '▶'}
        </button>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: sentColor, flexShrink: 0 }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)', minWidth: 50 }}>{pid.pid}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200, flex: 1 }}>
          {pid.cxName ?? '—'}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto', flexShrink: 0 }}>
          {pid.items.length} urgent · {pid.daysSilent}d silent
        </span>
      </div>
      {expanded && (
        <ul style={{ padding: '6px 0 10px 36px', margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {pid.items.map((it, i) => (
            <li key={i} style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              · {it.meta ? <span style={{ color: 'var(--text-dim)' }}>{it.meta}: </span> : null}{it.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function TopOfMind({ pids }: { pids: UrgentPid[] }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set(pids[0] ? [0] : []))

  if (pids.length === 0) {
    return (
      <div className="card card--flat fade-in">
        <div className="section-header">
          <div className="eyebrow">
            <span className="panel-ai-dot" aria-hidden />
            Top of Mind
          </div>
          <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>from latest briefs</span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0 4px', lineHeight: 1.6 }}>
          Nothing urgent across your portfolio right now. Open Projects to scan Pulse.
        </div>
      </div>
    )
  }

  return (
    <div className="card card--flat fade-in" style={{ borderLeft: '3px solid var(--critical)' }}>
      <div className="section-header">
        <div className="eyebrow">
          <span className="panel-ai-dot" aria-hidden />
          Top of Mind · {pids.length} {pids.length === 1 ? 'PID' : 'PIDs'}
        </div>
        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>from latest briefs</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {pids.map((pid, i) => (
          <TopOfMindRow
            key={pid.pid}
            pid={pid}
            expanded={expanded.has(i)}
            onToggle={() => setExpanded((prev) => {
              const next = new Set(prev)
              if (next.has(i)) next.delete(i); else next.add(i)
              return next
            })}
          />
        ))}
      </div>
    </div>
  )
}
