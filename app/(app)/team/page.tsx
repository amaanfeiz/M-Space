import { createClient } from '@/lib/supabase/server'
import { formatCouple, formatInr, riskDotClass } from '@/lib/types/project'
import { PIDLink } from '@/components/panel/PIDLink'

type PlannerGroup = {
  name: string
  pids: Array<{ pid: number; cx_name: string | null; overall_pid_risk: string | null; bgmv: number | null; event_start_date: string | null }>
  bgmvTotal: number
}

export default async function TeamPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('projects')
    .select('pid, cx_name, planner, designer, project_manager, overall_pid_risk, bgmv, project_health, event_start_date')

  const projects = data ?? []

  const plannerMap = new Map<string, PlannerGroup>()
  for (const p of projects) {
    const name = p.planner ?? 'Unassigned'
    const group: PlannerGroup = plannerMap.get(name) ?? { name, pids: [], bgmvTotal: 0 }
    group.pids.push(p)
    group.bgmvTotal += p.bgmv ?? 0
    plannerMap.set(name, group)
  }
  const planners = Array.from(plannerMap.values()).sort((a, b) => b.pids.length - a.pids.length)

  return (
    <>
      <div className="eyebrow" style={{ marginBottom: 16 }}>Team · By Planner</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {planners.map((pl) => (
          <div key={pl.name} className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>{pl.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{pl.pids.length} PIDs · {formatInr(pl.bgmvTotal)} BGMV</div>
              </div>
            </div>
            <div>
              {pl.pids.map((p) => (
                <PIDLink
                  key={p.pid}
                  pid={p.pid}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}
                >
                  <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: 'var(--text-dim)', minWidth: 52 }}>{p.pid}</span>
                  <span className={`status-dot ${riskDotClass(p.overall_pid_risk)}`} />
                  <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, flex: 1 }}>{formatCouple(p.cx_name)}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {p.event_start_date
                      ? new Date(p.event_start_date).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
                      : '—'}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatInr(p.bgmv)}</span>
                </PIDLink>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ height: 8 }} />
    </>
  )
}
