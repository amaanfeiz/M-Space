type Metric = {
  label: string
  value: string
  dot?: 'critical' | 'attention' | null
  change: string
  changeType: 'good' | 'bad' | 'neutral'
}

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
  const metrics: Metric[] = [
    {
      label: 'Live Projects',
      value: String(livePids),
      change: 'Booked and active',
      changeType: 'neutral',
    },
    {
      label: 'Total BGMV',
      value: totalBgmv,
      change: 'Across your portfolio',
      changeType: 'neutral',
    },
    {
      label: 'Critical',
      value: String(criticalCount),
      dot: 'critical',
      change: criticalCount > 0 ? 'Needs immediate attention' : 'No critical risks',
      changeType: criticalCount > 0 ? 'bad' : 'neutral',
    },
    {
      label: 'Attention',
      value: String(attentionCount),
      dot: 'attention',
      change: attentionCount > 0 ? `${attentionCount} items to watch` : 'No attention items',
      changeType: attentionCount > 0 ? 'bad' : 'neutral',
    },
  ]

  return (
    <div className="metrics-row">
      {metrics.map((m, i) => (
        <div
          key={m.label}
          className="card fade-in"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <div className="metric-label">{m.label}</div>
          <div className="metric-number">
            {m.dot && (
              <span className={`status-dot dot-${m.dot}`} />
            )}
            {m.value}
          </div>
          <div className={`metric-change change-${m.changeType}`}>
            {m.change}
          </div>
        </div>
      ))}
    </div>
  )
}
