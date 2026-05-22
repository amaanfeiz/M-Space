'use client'

type PortfolioEntry = {
  type: string   // 'outlier' | 'pattern' | 'escalation' | 'directive'
  text: string
}

type PortfolioMentionsProps = {
  pid: number
  entries: PortfolioEntry[]
  briefDate: string
}

const TYPE_COLORS: Record<string, string> = {
  outlier:   'var(--attention)',
  pattern:   'var(--accent)',
  escalation:'var(--critical)',
  directive: 'var(--text-muted)',
}

export function PortfolioMentions({ entries, briefDate }: Omit<PortfolioMentionsProps, 'pid'> & { pid: number }) {
  if (entries.length === 0) return null

  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 7 }}>
        Portfolio Brief — {briefDate}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {entries.map((e, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 11 }}>
            <span style={{
              fontSize: 9,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: TYPE_COLORS[e.type] ?? 'var(--text-dim)',
              flexShrink: 0,
              paddingTop: 1,
              minWidth: 60,
            }}>
              [{e.type}]
            </span>
            <span style={{ color: 'var(--text-muted)', lineHeight: 1.55 }}>{e.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Scans a portfolio brief_json object for references to a given PID.
export function extractPortfolioMentions(
  briefJson: Record<string, unknown>,
  pid: number,
): PortfolioEntry[] {
  const pidStr = String(pid)
  const entries: PortfolioEntry[] = []

  function textContainsPid(val: unknown): boolean {
    if (typeof val === 'string') return val.includes(pidStr)
    if (typeof val === 'number') return val === pid
    return false
  }

  function scanEntry(type: string, entry: unknown) {
    if (typeof entry === 'string' && entry.includes(pidStr)) {
      entries.push({ type, text: entry })
      return
    }
    if (typeof entry === 'object' && entry !== null) {
      const obj = entry as Record<string, unknown>
      // Check if any field references this PID
      const hasRef = Object.values(obj).some(textContainsPid)
      if (hasRef) {
        // Try to get a description field
        const text = (obj.description ?? obj.text ?? obj.summary ?? obj.action ?? JSON.stringify(entry)) as string
        entries.push({ type, text: String(text) })
      }
    }
  }

  const typeMap: Record<string, string> = {
    outliers: 'outlier',
    patterns: 'pattern',
    predicted_escalations: 'escalation',
    weekly_directives: 'directive',
  }

  for (const [key, label] of Object.entries(typeMap)) {
    const arr = briefJson[key]
    if (Array.isArray(arr)) {
      arr.forEach((item) => scanEntry(label, item))
    }
  }

  return entries
}
