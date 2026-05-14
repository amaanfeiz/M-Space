import { createClient } from '@/lib/supabase/server'
import { ProjectsTable } from '@/components/projects/ProjectsTable'
import { Layers } from 'lucide-react'

interface BriefSummary {
  sentiment: string
  flags: number
  actions: number
}

export default async function ProjectsPage() {
  const supabase = await createClient()

  const [{ data }, { data: briefRows }] = await Promise.all([
    supabase
      .from('projects')
      .select('pid, cx_name, status, planner, designer, project_manager, event_start_date, overall_pid_risk, bgmv, collection_pct, region, state, city')
      .order('event_start_date', { ascending: true }),
    supabase
      .from('briefs')
      .select('pid, brief_date, brief_json')
      .order('brief_date', { ascending: false })
      .limit(200),
  ])

  const projects = data ?? []

  // Keep only the most recent brief per PID
  const briefMap = new Map<number, BriefSummary>()
  for (const b of briefRows ?? []) {
    if (briefMap.has(b.pid)) continue
    const j = b.brief_json as { client_pulse?: { sentiment?: string }; cross_source_flags?: unknown[]; needs_you?: unknown[] }
    briefMap.set(b.pid, {
      sentiment: j?.client_pulse?.sentiment ?? '',
      flags: j?.cross_source_flags?.length ?? 0,
      actions: j?.needs_you?.length ?? 0,
    })
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-text">
          <h1>Projects</h1>
          <p>{projects.length} PIDs · sorted by event date</p>
        </div>
      </div>
      <div className="card card--flat" style={{ padding: 0 }}>
        {projects.length === 0 ? (
          <div className="empty-state">
            <Layers />
            <div className="empty-state-title">No projects found</div>
            <div className="empty-state-sub">Projects will appear here once the tracker syncs.</div>
          </div>
        ) : (
          <ProjectsTable projects={projects} briefMap={briefMap} />
        )}
      </div>
    </>
  )
}
