import { AnimatedCounter } from './AnimatedCounter'

type MetricsRowProps = {
  livePids: number
  totalBgmv: string
  criticalPidCount: number
  avgCollectionPct: number
  totalCollected: number
  totalContracted: number
}

function formatInrCompact(n: number): string {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(1)}Cr`
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`
  return `₹${n.toLocaleString('en-IN')}`
}

export function MetricsRow({
  livePids,
  totalBgmv,
  criticalPidCount,
  avgCollectionPct,
  totalCollected,
  totalContracted,
}: MetricsRowProps) {
  return (
    <div className="metrics-bento">
      <div className="card metric-card stagger-1">
        <div className="metric-label">Live Projects</div>
        <div className="metric-number">
          <AnimatedCounter value={livePids} />
        </div>
        <div className="metric-change change-neutral">Booked and active</div>
      </div>

      <div className="card metric-card stagger-2">
        <div className="metric-label">Total BGMV</div>
        <div className="metric-number metric-number--sm">{totalBgmv}</div>
        <div className="metric-change change-neutral">Across your portfolio</div>
      </div>

      <div className={`card metric-card stagger-3${criticalPidCount > 0 ? ' metric-card--critical' : ''}`}>
        <div className="metric-label">Critical PIDs</div>
        <div className="metric-number">
          <span className="status-dot dot-critical" style={{ marginRight: 8 }} />
          <AnimatedCounter value={criticalPidCount} />
        </div>
        <div className={`metric-change ${criticalPidCount > 0 ? 'change-bad' : 'change-neutral'}`}>
          {criticalPidCount > 0 ? 'Sentiment cold or anxious' : 'No critical sentiment'}
        </div>
      </div>

      <div className="card metric-card stagger-4">
        <div className="metric-label">Avg collection</div>
        <div className="metric-number">
          <AnimatedCounter value={avgCollectionPct} />
          <span style={{ fontSize: '0.5em', marginLeft: 4 }}>%</span>
        </div>
        <div className="metric-change change-neutral" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {formatInrCompact(totalCollected)} of {formatInrCompact(totalContracted)}
        </div>
      </div>
    </div>
  )
}
