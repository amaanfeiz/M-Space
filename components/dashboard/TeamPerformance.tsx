import type { Project } from '@/lib/types/project'
import { formatInr } from '@/lib/types/project'

type PlannerRow = {
  planner: string
  pidCount: number
  bgmvTotal: number
  avgHealth: number
  healthSegs: ('healthy' | 'attention' | 'critical')[]
}

export function groupByPlanner(projects: Project[]): PlannerRow[] {
  const map = new Map<string, Project[]>()
  for (const p of projects) {
    const key = p.planner
    if (!key) continue
    const existing = map.get(key) ?? []
    existing.push(p)
    map.set(key, existing)
  }
  return Array.from(map.entries())
    .map(([planner, pids]) => {
      const avgHealth = pids.reduce((s, p) => s + (p.project_health ?? 3), 0) / pids.length
      const bgmvTotal = pids.reduce((s, p) => s + (p.bgmv ?? 0), 0)
      const segs = pids.slice(0, 8).map((p): 'healthy' | 'attention' | 'critical' => {
        const h = p.project_health ?? 3
        if (h >= 4) return 'healthy'
        if (h >= 3) return 'attention'
        return 'critical'
      })
      return { planner, pidCount: pids.length, bgmvTotal, avgHealth, healthSegs: segs }
    })
    .sort((a, b) => b.pidCount - a.pidCount)
    .slice(0, 4)
}

function initials(name: string): string {
  return name.split(' ').slice(0, 2).map((n) => n.charAt(0).toUpperCase()).join('')
}

export function TeamPerformance({ planners }: { planners: PlannerRow[] }) {
  if (planners.length === 0) return null

  return (
    <div className="fade-in" style={{ animationDelay: '400ms' }}>
      <div className="eyebrow" style={{ marginBottom: 12 }}>Team Performance</div>
      <div className="team-row">
        {planners.map((row) => {
          const pct = Math.round((row.avgHealth / 5) * 100)
          const pctColor = pct >= 70 ? 'var(--healthy)' : pct >= 45 ? 'var(--attention)' : 'var(--critical)'
          return (
            <div key={row.planner} className="card card--flat" style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className="avatar" style={{ width: 28, height: 28, fontSize: 10 }}>
                    {initials(row.planner)}
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                      {row.planner.split(' ')[0]}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                      {row.pidCount} PIDs
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: pctColor, letterSpacing: '-0.02em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                    {pct}%
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 1 }}>healthy</div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontVariantNumeric: 'tabular-nums' }}>
                {formatInr(row.bgmvTotal)} BGMV
              </div>
              <div className="health-bar">
                {row.healthSegs.map((seg, i) => (
                  <div key={i} className="health-seg" style={{ background: `var(--${seg})` }} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function computeHealthSegColor(health: number): string {
  if (health >= 4) return 'var(--healthy)'
  if (health >= 3) return 'var(--attention)'
  return 'var(--critical)'
}
