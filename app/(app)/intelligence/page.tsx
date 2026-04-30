'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { INSIGHTS } from '@/lib/static/insights_static'

function InsightCard({ ins }: { ins: (typeof INSIGHTS)[number] }) {
  const [open, setOpen] = useState(false)
  const expandable = !!ins.expandItems?.length

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            padding: '3px 7px',
            borderRadius: 3,
            background: `${ins.badgeColor}15`,
            color: ins.badgeColor,
            border: `1px solid ${ins.badgeColor}25`,
            whiteSpace: 'nowrap',
          }}
        >
          {ins.badge}
        </span>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            fontFamily: 'var(--font-display)',
            color: 'var(--text-primary)',
            whiteSpace: 'nowrap',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {ins.kpi}
        </div>
      </div>

      <div
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: 'var(--text-primary)',
          letterSpacing: '-0.01em',
        }}
      >
        {ins.title}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        {ins.body}
      </div>

      {expandable && (
        <>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            style={{
              marginTop: 4,
              fontSize: 11,
              color: 'var(--accent)',
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              alignSelf: 'flex-start',
            }}
          >
            {open ? <ChevronDown style={{ width: 11, height: 11 }} /> : <ChevronRight style={{ width: 11, height: 11 }} />}
            {open ? 'Hide details' : 'Show details'}
          </button>
          {open && (
            <div
              style={{
                marginTop: 4,
                display: 'flex',
                flexDirection: 'column',
                gap: 0,
                background: 'var(--surface-elevated)',
                borderRadius: 6,
                padding: '8px 10px',
              }}
            >
              {ins.expandItems!.map((item, i) => (
                <div
                  key={i}
                  onClick={() => {
                    if (item.pid) window.location.hash = `#pid=${item.pid}`
                  }}
                  style={{
                    padding: '8px 0',
                    borderBottom:
                      i < ins.expandItems!.length - 1
                        ? '1px solid var(--border-subtle)'
                        : 'none',
                    cursor: item.pid ? 'pointer' : 'default',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: item.commits?.length ? 6 : 0,
                    }}
                  >
                    {item.pid && (
                      <span
                        style={{
                          fontFamily: "'Courier New', monospace",
                          fontSize: 11,
                          color: 'var(--text-dim)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {item.pid}
                      </span>
                    )}
                    {item.couple && (
                      <span
                        style={{
                          fontSize: 12,
                          color: 'var(--text-primary)',
                          fontWeight: 500,
                          flex: 1,
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.couple}
                      </span>
                    )}
                    {item.value && (
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {item.value}
                      </span>
                    )}
                  </div>
                  {item.venue && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 0 }}>
                      {item.venue}
                    </div>
                  )}
                  {item.commits?.map((c, ci) => (
                    <div
                      key={ci}
                      style={{
                        fontSize: 11,
                        color: 'var(--text-muted)',
                        paddingLeft: 10,
                        borderLeft: '2px solid var(--border-subtle)',
                        marginTop: 4,
                        lineHeight: 1.5,
                      }}
                    >
                      {c}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function IntelligencePage() {
  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 18,
              fontWeight: 600,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
            }}
          >
            Portfolio Intelligence
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
            Structural signals and pattern analysis across your active projects
          </div>
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-dim)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-btn)',
            padding: '4px 10px',
          }}
        >
          synced data
        </div>
      </div>

      <div className="insight-grid">
        {INSIGHTS.map((ins) => (
          <InsightCard key={ins.id} ins={ins} />
        ))}
      </div>
      <div style={{ height: 8 }} />
    </>
  )
}
