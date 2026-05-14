import { PIDLink } from '@/components/panel/PIDLink'

export interface UrgentItem {
  pid: number
  cxName: string | null
  action: string
  sentiment: string
}

const SENTIMENT_COLOR: Record<string, string> = {
  cold: 'var(--critical)',
  anxious: 'var(--critical)',
  cautious: 'var(--attention)',
  neutral: 'var(--text-dim)',
  positive: 'var(--healthy)',
}

export function TopOfMind({ items }: { items: UrgentItem[] }) {
  if (items.length === 0) {
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
    <div
      className="card card--flat fade-in"
      style={{ borderLeft: '3px solid var(--critical)' }}
    >
      <div className="section-header">
        <div className="eyebrow">
          <span className="panel-ai-dot" aria-hidden />
          Top of Mind · {items.length} urgent
        </div>
        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>from latest briefs</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {items.map((item, i) => {
          const sentColor = SENTIMENT_COLOR[item.sentiment] ?? 'var(--text-dim)'
          return (
            <PIDLink
              key={`${item.pid}-${i}`}
              pid={item.pid}
              className="top-of-mind-row"
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 10,
                padding: '8px 4px',
                borderBottom: i < items.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                cursor: 'pointer',
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: sentColor,
                  flexShrink: 0,
                  alignSelf: 'center',
                }}
              />
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--text-dim)',
                  fontVariantNumeric: 'tabular-nums',
                  flexShrink: 0,
                  minWidth: 50,
                }}
              >
                {item.pid}
              </span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: 140,
                }}
              >
                {item.cxName ?? '—'}
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  lineHeight: 1.5,
                  flex: 1,
                  minWidth: 0,
                }}
              >
                {item.action}
              </span>
            </PIDLink>
          )
        })}
      </div>
    </div>
  )
}
