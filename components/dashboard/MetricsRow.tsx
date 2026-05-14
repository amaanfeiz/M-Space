import { AnimatedCounter } from './AnimatedCounter'

type MetricsRowProps = {
  livePids: number
  totalBgmv: string
  /** Count of urgent needs_you items across all latest briefs. */
  urgentFlagCount: number
  /** Count of commitments in open or overdue status across all latest briefs. */
  openCommitmentCount: number
}

export function MetricsRow({
  livePids,
  totalBgmv,
  urgentFlagCount,
  openCommitmentCount,
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

      <div className={`card metric-card stagger-3${urgentFlagCount > 0 ? ' metric-card--critical' : ''}`}>
        <div className="metric-label">Urgent flags</div>
        <div className="metric-number">
          <span className="status-dot dot-critical" style={{ marginRight: 8 }} />
          <AnimatedCounter value={urgentFlagCount} />
        </div>
        <div className={`metric-change ${urgentFlagCount > 0 ? 'change-bad' : 'change-neutral'}`}>
          {urgentFlagCount > 0 ? 'Needs immediate action' : 'No urgent flags'}
        </div>
      </div>

      <div className={`card metric-card stagger-4${openCommitmentCount > 0 ? ' metric-card--attention' : ''}`}>
        <div className="metric-label">Open commitments</div>
        <div className="metric-number">
          <span className="status-dot dot-attention" style={{ marginRight: 8 }} />
          <AnimatedCounter value={openCommitmentCount} />
        </div>
        <div className={`metric-change ${openCommitmentCount > 0 ? 'change-bad' : 'change-neutral'}`}>
          {openCommitmentCount > 0 ? `${openCommitmentCount} pending follow-ups` : 'All commitments closed'}
        </div>
      </div>
    </div>
  )
}
