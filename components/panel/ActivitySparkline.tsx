'use client'

import { useState } from 'react'

export type SparklineDay = {
  date: string       // YYYY-MM-DD
  signalCount: number
  sentiment: string | null
}

const SENTIMENT_FILL: Record<string, string> = {
  positive: 'var(--healthy)',
  neutral:  'var(--text-dim)',
  cautious: 'var(--attention)',
  anxious:  'var(--critical)',
  cold:     '#7f1d1d',
}

function sentimentColor(s: string | null): string {
  return SENTIMENT_FILL[s ?? ''] ?? 'var(--border-default, var(--border-subtle))'
}

export function ActivitySparkline({ days }: { days: SparklineDay[] }) {
  const [hovered, setHovered] = useState<SparklineDay | null>(null)

  if (days.length === 0) return null

  const maxCount = Math.max(...days.map((d) => d.signalCount), 1)
  // log-scale heights: log(n+1) normalized to [0,1]
  const logMax = Math.log(maxCount + 1)

  return (
    <div style={{ position: 'relative', padding: '0 20px' }}>
      {/* Bars */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 40 }}>
        {days.map((d) => {
          const isEmpty = d.signalCount === 0
          const logH = isEmpty ? 0 : Math.log(d.signalCount + 1) / logMax
          const barH = isEmpty ? 2 : Math.max(4, Math.round(logH * 32))
          const color = isEmpty ? 'var(--border-subtle)' : sentimentColor(d.sentiment)
          const isHov = hovered?.date === d.date
          return (
            <div
              key={d.date}
              title={`${d.date} · ${d.signalCount} signals${d.sentiment ? ` · ${d.sentiment}` : ''}`}
              onMouseEnter={() => setHovered(d)}
              onMouseLeave={() => setHovered(null)}
              style={{
                flex: 1,
                height: barH,
                background: color,
                opacity: isHov ? 1 : 0.75,
                borderRadius: 2,
                cursor: 'default',
                transition: 'opacity 0.1s',
                border: isEmpty ? '1px solid var(--border-subtle)' : 'none',
              }}
            />
          )
        })}
      </div>

      {/* Hover tooltip */}
      {hovered && (
        <div style={{
          position: 'absolute',
          bottom: 46,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--surface-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 4,
          padding: '4px 8px',
          fontSize: 10,
          color: 'var(--text-muted)',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 10,
        }}>
          <strong>{hovered.date}</strong>
          {' · '}
          {hovered.signalCount} signal{hovered.signalCount !== 1 ? 's' : ''}
          {hovered.sentiment && ` · ${hovered.sentiment}`}
        </div>
      )}
    </div>
  )
}
