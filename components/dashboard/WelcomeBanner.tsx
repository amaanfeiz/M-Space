'use client'

type WelcomeBannerProps = {
  userName: string
  totalPids: number
  sentimentCounts: Record<string, number>
  briefsCurrent: number
  yesterdayDelta: { criticalDelta: number; stalledDelta: number; closedDelta: number } | null
  dailyNudge: { pid: number; text: string } | null
}

function greetingTimeOfDay(): string {
  const nowIst = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
  const hour = nowIst.getUTCHours()
  return hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'
}

function SentimentStackedBar({ counts, totalPids }: { counts: Record<string, number>; totalPids: number }) {
  const order: Array<{ key: string; color: string }> = [
    { key: 'positive', color: 'var(--healthy)' },
    { key: 'neutral',  color: 'var(--text-dim)' },
    { key: 'cautious', color: 'var(--attention)' },
    { key: 'anxious',  color: 'var(--critical)' },
    { key: 'cold',     color: 'var(--critical)' },
  ]
  const total = order.reduce((s, o) => s + (counts[o.key] ?? 0), 0)
  if (total === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 280 }}>
      <div style={{ display: 'flex', gap: 2, height: 8, borderRadius: 4, overflow: 'hidden' }}>
        {order.map(({ key, color }) => {
          const n = counts[key] ?? 0
          if (n === 0) return null
          const pct = (n / total) * 100
          return <div key={key} style={{ background: color, flex: `${pct} 0 auto` }} />
        })}
      </div>
      <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{totalPids} PIDs</span>
        {order.map(({ key, color }) => {
          const n = counts[key] ?? 0
          if (n === 0) return null
          return (
            <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
              {n} {key}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function BriefsCurrentPill({ currentCount, totalCount }: { currentCount: number; totalCount: number }) {
  const fresh = currentCount === totalCount
  const color = fresh ? 'var(--healthy)' : 'var(--attention)'
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
      color, border: `1px solid ${color}33`, padding: '2px 6px', borderRadius: 3, whiteSpace: 'nowrap',
    }}>
      {currentCount}/{totalCount} briefs current
    </span>
  )
}

function DeltaInline({ label, value, bad, good }: { label: string; value: number; bad?: boolean; good?: boolean }) {
  if (value === 0) return <span>0 {label}</span>
  const sign = value > 0 ? '+' : ''
  const color = value > 0
    ? (bad ? 'var(--critical)' : good ? 'var(--healthy)' : 'var(--text-muted)')
    : (bad ? 'var(--healthy)' : good ? 'var(--critical)' : 'var(--text-muted)')
  return <span style={{ color }}>{sign}{value} {label}</span>
}

export function WelcomeBanner({
  userName, totalPids, sentimentCounts, briefsCurrent, yesterdayDelta, dailyNudge,
}: WelcomeBannerProps) {
  const firstName = userName.split(' ')[0] || userName
  const greeting = `Good ${greetingTimeOfDay()}, ${firstName}.`
  return (
    <div className="welcome-banner" style={{ display: 'flex', gap: 24, alignItems: 'flex-start', padding: '16px 20px' }}>
      <div style={{ flex: '0 0 auto', minWidth: 200 }}>
        <div className="welcome-greeting" style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>
          {greeting}
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <SentimentStackedBar counts={sentimentCounts} totalPids={totalPids} />
          <BriefsCurrentPill currentCount={briefsCurrent} totalCount={totalPids} />
        </div>
        {yesterdayDelta && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Changed since yesterday:{' '}
            <DeltaInline label="critical" value={yesterdayDelta.criticalDelta} bad />
            {' · '}
            <DeltaInline label="stalled" value={yesterdayDelta.stalledDelta} bad />
            {' · '}
            <DeltaInline label="commits closed" value={yesterdayDelta.closedDelta} good />
          </div>
        )}
        {dailyNudge && (
          <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--accent)', marginRight: 6 }}>
              Today
            </span>
            <span
              className="cp-pid-link"
              style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent)', cursor: 'pointer', marginRight: 6 }}
              onClick={() => { window.location.hash = `#pid=${dailyNudge.pid}` }}
            >
              {dailyNudge.pid}
            </span>
            {dailyNudge.text}
          </div>
        )}
      </div>
    </div>
  )
}
