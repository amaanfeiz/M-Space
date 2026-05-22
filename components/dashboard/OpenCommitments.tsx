import { PIDLink } from '@/components/panel/PIDLink'

export type OpenCommitment = {
  pid: number
  cxName: string | null
  what: string
  owner: string
  status: 'open' | 'overdue'
  daysOverdue: number | null
}

export function OpenCommitments({ commitments }: { commitments: OpenCommitment[] }) {
  if (commitments.length === 0) {
    return (
      <div className="card card--flat">
        <div className="section-header">
          <div className="eyebrow">Open Commitments</div>
          <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>from briefs</span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0' }}>
          All commitments closed.
        </div>
      </div>
    )
  }
  return (
    <div className="card card--flat">
      <div className="section-header">
        <div className="eyebrow">Open Commitments</div>
        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{commitments.length} pending</span>
      </div>
      {commitments.map((c, i) => (
        <PIDLink key={`${c.pid}-${i}`} pid={c.pid} className="commit-row" style={{
          display: 'flex', alignItems: 'baseline', gap: 10, padding: '8px 4px',
          borderBottom: i < commitments.length - 1 ? '1px solid var(--border-subtle)' : 'none',
          cursor: 'pointer',
        }}>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
            color: c.status === 'overdue' ? 'var(--critical)' : 'var(--attention)',
            border: `1px solid ${c.status === 'overdue' ? 'var(--critical)' : 'var(--attention)'}33`,
            padding: '1px 5px', borderRadius: 3, flexShrink: 0, minWidth: 60, textAlign: 'center',
          }}>
            {c.status === 'overdue' ? `OD ${c.daysOverdue}d` : 'OPEN'}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)', flexShrink: 0, minWidth: 50 }}>{c.pid}</span>
          <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            &ldquo;{c.what}&rdquo;
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-dim)', flexShrink: 0 }}>— {c.owner}</span>
        </PIDLink>
      ))}
    </div>
  )
}
