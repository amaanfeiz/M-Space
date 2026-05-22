'use client'

type SectionNavProps = {
  visible: boolean
  activeSection: string
  unacknowledgedCount: number
  onScrollTo: (id: string) => void
}

export function SectionNav({ visible, unacknowledgedCount, onScrollTo }: SectionNavProps) {
  if (!visible) return null

  return (
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 20,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '5px 20px',
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border-subtle)',
      fontSize: 10,
      color: 'var(--text-dim)',
    }}>
      <button type="button" onClick={() => onScrollTo('section-unacknowledged')} style={btnStyle}>
        Unanswered
        {unacknowledgedCount > 0 && (
          <span style={{
            marginLeft: 4,
            background: 'var(--critical)',
            color: '#fff',
            borderRadius: 8,
            padding: '0 5px',
            fontSize: 9,
            fontWeight: 700,
          }}>
            {unacknowledgedCount}
          </span>
        )}
      </button>
      <span style={{ color: 'var(--border-subtle)' }}>·</span>
      <button type="button" onClick={() => onScrollTo('section-needs-you')} style={btnStyle}>
        Needs You
      </button>
      <span style={{ color: 'var(--border-subtle)' }}>·</span>
      <button type="button" onClick={() => onScrollTo('section-send-to-group')} style={btnStyle}>
        Send to Group
      </button>
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 10,
  fontWeight: 600,
  color: 'var(--text-dim)',
  padding: '2px 0',
  display: 'flex',
  alignItems: 'center',
}
