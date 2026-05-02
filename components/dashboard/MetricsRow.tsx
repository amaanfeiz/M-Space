import { AnimatedCounter } from './AnimatedCounter'

type MetricsRowProps = {
  livePids: number
  totalBgmv: string
  criticalCount: number
  attentionCount: number
}

export function MetricsRow({
  livePids,
  totalBgmv,
  criticalCount,
  attentionCount,
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

      <div className={`card metric-card stagger-3${criticalCount > 0 ? ' metric-card--critical' : ''}`}>
        <div className="metric-label">Critical</div>
        <div className="metric-number">
          <span className="status-dot dot-critical" style={{ marginRight: 8 }} />
          <AnimatedCounter value={criticalCount} />
        </div>
        <div className={`metric-change ${criticalCount > 0 ? 'change-bad' : 'change-neutral'}`}>
          {criticalCount > 0 ? 'Needs immediate attention' : 'No critical risks'}
        </div>
      </div>

      <div className={`card metric-card stagger-4${attentionCount > 0 ? ' metric-card--attention' : ''}`}>
        <div className="metric-label">Attention</div>
        <div className="metric-number">
          <span className="status-dot dot-attention" style={{ marginRight: 8 }} />
          <AnimatedCounter value={attentionCount} />
        </div>
        <div className={`metric-change ${attentionCount > 0 ? 'change-bad' : 'change-neutral'}`}>
          {attentionCount > 0 ? `${attentionCount} items to watch` : 'No attention items'}
        </div>
      </div>
    </div>
  )
}
