'use client'

import { useState } from 'react'

type RiskTrackerSnapshotProps = {
  collectionRisk: string | null
  communicationRisk: string | null
  sentimentRisk: string | null
  cancellationRiskLabel: string | null
  overallPidRisk: string | null
  currentSummary: string | null
  aiNotesSummary: string | null
  cancellationRiskReason: string | null
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'var(--critical)',
  attention: 'var(--attention)',
  healthy: 'var(--healthy)',
}

function riskColor(val: string | null): string {
  return SEVERITY_COLOR[val?.toLowerCase() ?? ''] ?? 'var(--text-dim)'
}

export function RiskTrackerSnapshot({
  collectionRisk,
  communicationRisk,
  sentimentRisk,
  cancellationRiskLabel,
  overallPidRisk,
  currentSummary,
  aiNotesSummary,
  cancellationRiskReason,
}: RiskTrackerSnapshotProps) {
  const [open, setOpen] = useState(false)

  const rows = [
    { label: 'Collection Risk', value: collectionRisk },
    { label: 'Communication Risk', value: communicationRisk },
    { label: 'Sentiment Risk', value: sentimentRisk },
    { label: 'Cancellation Risk', value: cancellationRiskLabel },
    { label: 'Overall PID Risk', value: overallPidRisk },
  ]

  return (
    <div id="section-risk-tracker" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 10, marginTop: 6 }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--text-dim)',
          fontFamily: 'inherit',
        }}
      >
        Risk Tracker Snapshot {open ? '▾' : '▸'}
      </button>

      {open && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Categorical risks */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {rows.map((r) => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span style={{ color: 'var(--text-dim)' }}>{r.label}</span>
                <span style={{ fontWeight: 600, color: riskColor(r.value) }}>{r.value ?? '—'}</span>
              </div>
            ))}
          </div>

          {/* Disclaimer */}
          <div style={{ fontSize: 10, color: 'var(--text-dim)', fontStyle: 'italic', borderTop: '1px solid var(--border-subtle)', paddingTop: 6 }}>
            Strategy team analysis — not read by AI briefs.
          </div>

          {/* Text content */}
          {(currentSummary || aiNotesSummary || cancellationRiskReason) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {currentSummary && (
                <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>{currentSummary}</p>
              )}
              {aiNotesSummary && (
                <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>{aiNotesSummary}</p>
              )}
              {cancellationRiskReason && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Cancellation reason: </span>
                  {cancellationRiskReason}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
