import { createClient } from '@/lib/supabase/server'
import { ProjectsTable } from '@/components/projects/ProjectsTable'
import { Layers } from 'lucide-react'

export default async function ProjectsPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('projects')
    .select('pid, cx_name, status, planner, designer, project_manager, event_start_date, overall_pid_risk, bgmv, collection_pct, cancellation_risk, region, state, city')
    .order('event_start_date', { ascending: true })

  const projects = data ?? []

  return (
    <>
      <div className="page-header">
        <div className="page-header-text">
          <h1>Projects</h1>
          <p>{projects.length} active PIDs · sorted by event date</p>
        </div>
      </div>
      {/* No overflow on card — lets sticky thead work */}
      <div className="card card--flat" style={{ padding: 0 }}>
        {projects.length === 0 ? (
          <div className="empty-state">
            <Layers />
            <div className="empty-state-title">No projects found</div>
            <div className="empty-state-sub">Projects will appear here once the tracker syncs.</div>
          </div>
        ) : (
          <ProjectsTable projects={projects} />
        )}
      </div>
    </>
  )
}
