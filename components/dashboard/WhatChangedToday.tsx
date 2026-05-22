import { PIDLink } from '@/components/panel/PIDLink'

export type ChangeItem = {
  pid: number
  cxName: string | null
  sentiment: string
  text: string
}

const SENTIMENT_COLOR: Record<string, string> = {
  positive: 'var(--healthy)', neutral: 'var(--text-dim)',
  cautious: 'var(--attention)', anxious: 'var(--critical)', cold: 'var(--critical)',
}

export function WhatChangedToday({ items, briefDate }: { items: ChangeItem[]; briefDate: string | null }) {
  if (items.length === 0) return null
  return (
    <div className="card card--flat fade-in" style={{ animationDelay: '600ms' }}>
      <div className="section-header">
        <div className="eyebrow">What Changed Today</div>
        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
          {briefDate ? `briefs · ${briefDate}` : 'briefs'}
        </span>
      </div>
      {items.map((item, i) => {
        const color = SENTIMENT_COLOR[item.sentiment] ?? 'var(--text-dim)'
        return (
          <PIDLink
            key={`${item.pid}-${i}`}
            pid={item.pid}
            className="change-row"
            style={{
              display: 'flex', alignItems: 'baseline', gap: 10, padding: '8px 4px',
              borderBottom: i < items.length - 1 ? '1px solid var(--border-subtle)' : 'none',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0, alignSelf: 'center' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)', flexShrink: 0, minWidth: 50 }}>{item.pid}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>
              {item.cxName ?? '—'}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, flex: 1, minWidth: 0 }}>
              {item.text}
            </span>
          </PIDLink>
        )
      })}
    </div>
  )
}
