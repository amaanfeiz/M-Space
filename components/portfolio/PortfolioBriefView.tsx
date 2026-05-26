'use client'

export interface PortfolioBriefJSON {
  executive_summary: string
  patterns: Array<{
    pattern: string
    pids: number[]
    severity: 'high' | 'medium' | 'low'
  }>
  outliers: Array<{
    pid: number
    cx_name: string
    why: string
  }>
  predicted_escalations: Array<{
    pid: number
    cx_name: string
    likely_issue: string
    window: string
  }>
  weekly_directives: string[]
  amaan_pattern_observations: string[]
  counterfactuals: Array<{
    days_ago: number
    pid: number
    suggested: string
    happened: string
    outcome: string
  }>
}

const SEVERITY_COLOR: Record<string, string> = {
  high: 'var(--critical)',
  medium: 'var(--attention)',
  low: 'var(--text-dim)',
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h2 style={{
        fontSize: 11, fontWeight: 700, letterSpacing: 1.2,
        color: 'var(--text-dim)', textTransform: 'uppercase', margin: 0,
        display: 'flex', alignItems: 'baseline', gap: 6,
      }}>
        {title}
        {typeof count === 'number' && count > 0 && (
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>
            ({count})
          </span>
        )}
      </h2>
      <div>{children}</div>
    </section>
  )
}

function PidChip({ pid }: { pid: number }) {
  return (
    <button
      type="button"
      onClick={() => { window.location.hash = `pid=${pid}` }}
      style={{
        fontSize: 10, padding: '2px 6px', borderRadius: 3,
        background: 'var(--surface-elevated)', color: 'var(--text-dim)',
        fontFamily: 'var(--font-mono)', textDecoration: 'none',
        border: '1px solid var(--border-subtle)',
        cursor: 'pointer',
      }}
    >
      {pid}
    </button>
  )
}

export function PortfolioBriefView({
  brief,
  briefDate: _briefDate,
  generatedAt,
}: {
  brief: PortfolioBriefJSON
  briefDate: string
  generatedAt: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Executive summary */}
      <div style={{
        padding: '12px 14px', background: 'var(--surface-elevated)',
        borderLeft: '3px solid var(--accent)', borderRadius: 4,
      }}>
        <div style={{
          fontSize: 9, fontWeight: 700, color: 'var(--text-dim)',
          textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
        }}>
          Executive summary
        </div>
        <p style={{
          fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6, margin: 0,
        }}>
          {brief.executive_summary}
        </p>
        <div style={{
          fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)',
          marginTop: 8,
        }}>
          generated {new Date(generatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
        </div>
      </div>

      {/* Patterns */}
      <Section title="Patterns" count={brief.patterns.length}>
        {brief.patterns.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--text-dim)', fontStyle: 'italic', margin: 0 }}>
            No cross-PID patterns identified today.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {brief.patterns.map((p, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{
                    fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                    color: SEVERITY_COLOR[p.severity] ?? 'var(--text-dim)',
                    flexShrink: 0, paddingTop: 2, letterSpacing: 0.5, minWidth: 50,
                  }}>
                    {p.severity}
                  </span>
                  <p style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5, margin: 0 }}>
                    {p.pattern}
                  </p>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginLeft: 58 }}>
                  {p.pids.map((pid) => <PidChip key={pid} pid={pid} />)}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Outliers */}
      <Section title="Outliers" count={brief.outliers.length}>
        {brief.outliers.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--text-dim)', fontStyle: 'italic', margin: 0 }}>
            No single-PID outliers worth amplifying.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {brief.outliers.map((o, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                  <PidChip pid={o.pid} />
                  <span style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 600 }}>
                    {o.cx_name}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5, margin: 0, paddingLeft: 4 }}>
                  {o.why}
                </p>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Predicted escalations */}
      <Section title="Predicted escalations" count={brief.predicted_escalations.length}>
        {brief.predicted_escalations.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--text-dim)', fontStyle: 'italic', margin: 0 }}>
            No escalations predicted in the next 1-2 weeks.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {brief.predicted_escalations.map((e, i) => (
              <div key={i} style={{
                padding: '8px 10px', background: 'var(--surface-elevated)',
                borderLeft: '2px solid var(--attention)', borderRadius: 3,
                display: 'flex', flexDirection: 'column', gap: 4,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                    <PidChip pid={e.pid} />
                    <span style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 600 }}>
                      {e.cx_name}
                    </span>
                  </div>
                  <span style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                    {e.window}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5, margin: 0 }}>
                  {e.likely_issue}
                </p>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Weekly directives */}
      {brief.weekly_directives.length > 0 && (
        <Section title="Weekly directives">
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {brief.weekly_directives.map((d, i) => (
              <li key={i} style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                {d}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Amaan's pattern observations */}
      {brief.amaan_pattern_observations.length > 0 && (
        <Section title="Pattern observations">
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {brief.amaan_pattern_observations.map((o, i) => (
              <li key={i} style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                {o}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Counterfactuals */}
      {brief.counterfactuals.length > 0 && (
        <Section title="Counterfactuals" count={brief.counterfactuals.length}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {brief.counterfactuals.map((c, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                    {c.days_ago}d ago
                  </span>
                  <PidChip pid={c.pid} />
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                  <span style={{ color: 'var(--text-dim)' }}>suggested:</span> {c.suggested}<br />
                  <span style={{ color: 'var(--text-dim)' }}>happened:</span> {c.happened}<br />
                  <span style={{ color: 'var(--text-dim)' }}>outcome:</span> {c.outcome}
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}
