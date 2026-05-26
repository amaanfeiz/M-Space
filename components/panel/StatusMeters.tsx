'use client'

import { useRef } from 'react'

// ── Health meter (1–5) ────────────────────────────────────────────────────
const HEALTH_COLORS: Record<number, string> = {
  5: 'var(--healthy)',
  4: '#4ade80',
  3: 'var(--attention)',
  2: '#f97316',
  1: 'var(--critical)',
}

function HealthMeter({ value }: { value: number | null }) {
  const v = Math.max(1, Math.min(5, value ?? 0))
  const color = HEALTH_COLORS[v] ?? 'var(--text-dim)'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3 }}>
      <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)' }}>Health</div>
      <div style={{ display: 'flex', gap: 3 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: i <= v ? color : 'var(--border-subtle)',
              border: `1px solid ${i <= v ? color : 'var(--border-subtle)'}`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

// ── Cancel Risk meter (0–5) ───────────────────────────────────────────────
const CANCEL_COLORS: Record<number, string> = {
  0: 'var(--border-subtle)',
  1: 'var(--healthy)',
  2: 'var(--attention)',
  3: '#f97316',
  4: 'var(--critical)',
  5: 'var(--critical)',
}

function CancelMeter({ value }: { value: number | null }) {
  const v = Math.max(0, Math.min(5, value ?? 0))
  const color = CANCEL_COLORS[v] ?? 'var(--text-dim)'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3 }}>
      <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)' }}>Cancel Risk</div>
      <div style={{ display: 'flex', gap: 3 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: i <= v ? color : 'var(--border-subtle)',
              border: `1px solid ${i <= v ? color : 'var(--border-subtle)'}`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

// ── Risk pills ─────────────────────────────────────────────────────────────
type RiskPillData = {
  label: string
  severity: string
  source: 'tracker' | 'brief'
  tooltip?: string
}

function severityColor(s: string): string {
  const l = s.toLowerCase()
  if (l === 'critical') return 'var(--critical)'
  if (l === 'attention') return 'var(--attention)'
  return 'var(--text-dim)'
}

function RiskPill({ pill, onScrollTo }: { pill: RiskPillData; onScrollTo?: () => void }) {
  const ref = useRef<HTMLSpanElement>(null)
  const color = severityColor(pill.severity)
  const isFilled = pill.source === 'tracker'
  return (
    <span
      ref={ref}
      title={pill.tooltip ?? (isFilled ? 'From Risk Tracker' : "From today's brief")}
      onClick={onScrollTo}
      style={{
        display: 'inline-block',
        fontSize: 9,
        fontWeight: 600,
        padding: '2px 7px',
        borderRadius: 10,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        cursor: onScrollTo ? 'pointer' : 'default',
        background: isFilled ? `${color}22` : 'transparent',
        border: `1px solid ${color}`,
        color,
        margin: '2px 3px 2px 0',
      }}
    >
      {pill.label}
    </span>
  )
}

// ── StatusStrip — the whole D1 block ──────────────────────────────────────
type StatusStripProps = {
  days: number | null
  projectHealth: number | null
  cancellationRisk: number | null
  // Risk Tracker categorical fields (text: 'Healthy' | 'Attention' | 'Critical')
  collectionRisk: string | null
  communicationRisk: string | null
  sentimentRisk: string | null
  // Brief needs_you for brief-flagged pills (optional)
  needsYou?: NeedsYouItem[]
  onScrollToRiskTracker?: () => void
}

const TRACKER_RISK_LABELS: Array<{ field: keyof StatusStripProps; label: string }> = [
  { field: 'collectionRisk', label: 'Collection' },
  { field: 'communicationRisk', label: 'Communication' },
  { field: 'sentimentRisk', label: 'Sentiment' },
]

type NeedsYouItem = {
  headline?: string
  detail?: string
  action?: string
  priority: string
  risk_type?: string
}

function extractBriefRiskPills(needsYou: NeedsYouItem[]): RiskPillData[] {
  const seen = new Set<string>()
  const pills: RiskPillData[] = []
  for (const n of needsYou) {
    const rt = n.risk_type
    if (rt && !seen.has(rt)) {
      seen.add(rt)
      pills.push({
        label: rt,
        severity: n.priority === 'urgent' ? 'critical' : 'attention',
        source: 'brief',
        tooltip: `From today's brief · ${n.headline || n.action || 'needs you'}`,
      })
    }
  }
  return pills
}

function daysColor(days: number | null): string {
  if (days == null) return 'var(--text-muted)'
  if (days < 0) return 'var(--text-dim)'
  if (days <= 30) return 'var(--critical)'
  if (days <= 60) return 'var(--attention)'
  return 'var(--healthy)'
}

export function StatusStrip({
  days,
  projectHealth,
  cancellationRisk,
  collectionRisk,
  communicationRisk,
  sentimentRisk,
  needsYou = [],
  onScrollToRiskTracker,
}: StatusStripProps) {
  // Standing pills from Risk Tracker
  const trackerPills: RiskPillData[] = TRACKER_RISK_LABELS
    .map(({ field, label }) => {
      const val = (field === 'collectionRisk' ? collectionRisk : field === 'communicationRisk' ? communicationRisk : sentimentRisk)
      const sev = val?.toLowerCase() ?? 'healthy'
      if (sev === 'healthy' || !val) return null
      return { label, severity: sev, source: 'tracker' as const, tooltip: `Risk Tracker · ${val}` }
    })
    .filter(Boolean) as RiskPillData[]

  // Brief-flagged pills from needs_you
  const briefPills = extractBriefRiskPills(needsYou)

  const dayColor = daysColor(days)

  return (
    <div className="panel-strip-row">
      {/* Days countdown */}
      {days !== null && (
        <div>
          <div className="panel-days-countdown" style={{ color: dayColor }}>{days < 0 ? `${Math.abs(days)}d ago` : days}</div>
          <div className="panel-days-label">{days < 0 ? 'Since event' : 'Days to event'}</div>
        </div>
      )}

      {/* Meters */}
      <div style={{ display: 'flex', gap: 16 }}>
        <HealthMeter value={projectHealth} />
        <CancelMeter value={cancellationRisk} />
      </div>

      {/* Risk pills */}
      {(trackerPills.length > 0 || briefPills.length > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {trackerPills.length > 0 && (
            <div>
              {trackerPills.map((p, i) => (
                <RiskPill key={i} pill={p} onScrollTo={onScrollToRiskTracker} />
              ))}
            </div>
          )}
          {briefPills.length > 0 && (
            <div>
              {briefPills.map((p, i) => (
                <RiskPill key={i} pill={p} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
