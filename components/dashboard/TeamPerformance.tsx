import type { Project } from '@/lib/types/project'
import { formatInr } from '@/lib/types/project'

type PlannerRow = {
  planner: string
  pidCount: number
  bgmvTotal: number
  avgHealth: number
  healthSegs: ('healthy' | 'attention' | 'critical')[]
}

type TeamPerformanceProps = {
  planners: PlannerRow[]
}

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n.charAt(0).toUpperCase())
    .join('')
}

function healthPct(avgHealth: number): number {
  return Math.round((avgHealth / 5) * 100)
}

function healthSegColor(health: number): string {
  if (health >= 4) return 'var(--healthy)'
  if (health >= 3) return 'var(--attention)'
  return 'var(--critical)'
}

export function groupByPlanner(projects: Project[]): PlannerRow[] {
  const map = new Map<string, Project[]>()
  for (const p of projects) {
    const key = p.planner ?? 'Unassigned'
    const existing = map.get(key) ?? []
    existing.push(p)
    map.set(key, existing)
  }
  return Array.from(map.entries())
    .map(([planner, pids]) => {
      const avgHealth =
        pids.reduce((s, p) => s + (p.project_health ?? 3), 0) / pids.length
      const bgmvTotal = pids.reduce((s, p) => s + (p.bgmv ?? 0), 0)
      const segCount = Math.min(pids.length, 6)
      const segs = pids.slice(0, segCount).map((p): 'healthy' | 'attention' | 'critical' => {
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

export function TeamPerformance({ planners }: TeamPerformanceProps) {
  if (planners.length === 0) return null

  return (
    <div className="fade-in" style={{ animationDelay: '400ms' }}>
      <div className="eyebrow" style={{ marginBottom: 16 }}>
        Team Performance
      </div>
      <div className="team-row">
        {planners.map((row, i) => (
          <div key={row.planner} className="card">
            <div className="team-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="team-label">Planner</div>
                <div className="team-badge">{i + 1}</div>
              </div>
              <div className="avatars-stack">
                <div
                  className="avatar-sm"
                  style={{
                    background: 'rgba(114,65,190,0.15)',
                    color: '#7241BE',
                  }}
                >
                  {initials(row.planner)}
                </div>
              </div>
            </div>
            <div
              className="team-pids"
              title={row.planner}
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {row.planner}
            </div>
            <div className="team-pids" style={{ marginTop: 4 }}>
              {row.pidCount}
            </div>
            <div className="team-bgmv">{formatInr(row.bgmvTotal)} BGMV</div>
            <div className="health-bar">
              {row.healthSegs.map((seg, si) => (
                <div
                  key={si}
                  className="health-seg"
                  style={{ background: `var(--${seg})` }}
                />
              ))}
            </div>
            <div className="health-label">{healthPct(row.avgHealth)}% healthy</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function computeHealthSegColor(health: number) {
  return healthSegColor(health)
}
