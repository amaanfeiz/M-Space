import { createClient } from '@/lib/supabase/server'
import { ProjectsTable } from '@/components/projects/ProjectsTable'

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
        <ProjectsTable projects={projects} />
      </div>
      <div style={{ height: 8 }} />
    </>
  )
}
