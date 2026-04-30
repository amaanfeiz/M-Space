'use client'

import { INSIGHTS } from '@/lib/static/insights_static'

export default function IntelligencePage() {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: -16 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Portfolio Intelligence
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
            Structural signals and pattern analysis across your active projects
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-btn)', padding: '4px 10px' }}>
          synced data
        </div>
      </div>

      <div className="insight-grid">
        {INSIGHTS.map((ins) => (
          <div key={ins.id} className="card">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
              <span
                style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                  padding: '2px 7px', borderRadius: 3,
                  background: `${ins.badgeColor}15`, color: ins.badgeColor, border: `1px solid ${ins.badgeColor}25`,
                }}
              >
                {ins.badge}
              </span>
              <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                {ins.kpi}
              </div>
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, letterSpacing: '-0.01em' }}>
              {ins.title}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              {ins.body}
            </div>
            {ins.expandItems && (
              <div style={{ marginTop: 12 }}>
                {ins.expandItems.map((item, i) => (
                  <div
                    key={i}
                    onClick={() => { if (item.pid) window.location.hash = `#pid=${item.pid}` }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 0', borderBottom: '1px solid var(--border-subtle)',
                      cursor: item.pid ? 'pointer' : 'default',
                    }}
                  >
                    {item.pid && (
                      <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: 'var(--text-dim)' }}>{item.pid}</span>
                    )}
                    {item.couple && (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>
                        {item.couple}{item.venue ? ` · ${item.venue}` : ''}
                      </span>
                    )}
                    {item.value && (
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{item.value}</span>
                    )}
                    {item.commits?.map((c, ci) => (
                      <div key={ci} style={{ fontSize: 11, color: 'var(--text-dim)', paddingLeft: 10, borderLeft: '2px solid var(--border-subtle)' }}>{c}</div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ height: 8 }} />
    </>
  )
}
