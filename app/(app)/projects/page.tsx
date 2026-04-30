import { createClient } from '@/lib/supabase/server'
import { formatCouple, formatInr, riskDotClass } from '@/lib/types/project'
import { PIDLink } from '@/components/panel/PIDLink'

export default async function ProjectsPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('projects')
    .select('pid, cx_name, status, planner, designer, project_manager, event_start_date, overall_pid_risk, bgmv, region, state, city')
    .order('event_start_date', { ascending: true })

  const projects = data ?? []

  return (
    <>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>All Projects</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, letterSpacing: '-0.025em', color: 'var(--text-primary)' }}>
              {projects.length} Active PIDs
            </div>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="projects-table">
            <thead>
              <tr>
                <th>PID</th>
                <th>Couple</th>
                <th>Region</th>
                <th>Planner</th>
                <th>Designer</th>
                <th>PM</th>
                <th>Event</th>
                <th>Health</th>
                <th>BGMV</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <PIDLink key={p.pid} pid={p.pid} style={{ display: 'contents' }}>
                  <tr onClick={() => { window.location.hash = `#pid=${p.pid}` }} style={{ cursor: 'pointer' }}>
                    <td style={{ color: 'var(--text-primary)', fontFamily: "'Courier New', monospace" }}>{p.pid}</td>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{formatCouple(p.cx_name)}</td>
                    <td>{p.state ?? p.city ?? '—'}</td>
                    <td>{p.planner ?? '—'}</td>
                    <td>{p.designer ?? '—'}</td>
                    <td>{p.project_manager ?? '—'}</td>
                    <td>
                      {p.event_start_date
                        ? new Date(p.event_start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
                        : '—'}
                    </td>
                    <td>
                      <span className={`status-dot ${riskDotClass(p.overall_pid_risk)}`} style={{ marginRight: 6 }} />
                      {p.overall_pid_risk ?? '—'}
                    </td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{formatInr(p.bgmv)}</td>
                  </tr>
                </PIDLink>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ height: 8 }} />
    </>
  )
}
