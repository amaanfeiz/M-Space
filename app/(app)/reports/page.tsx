import { createClient } from '@/lib/supabase/server'
import { CSVExportButton } from '@/components/reports/CSVExportButton'

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('projects')
    .select('pid, cx_name, status, planner, designer, project_manager, event_start_date, overall_pid_risk, bgmv, collection, collection_pct, venue, state, synced_at')

  const projects = data ?? []

  return (
    <>
      <div className="page-header">
        <div className="page-header-text">
          <h1>Reports</h1>
          <p>Portfolio exports — Phase 1.</p>
        </div>
        <span className="page-header-badge">Phase 1</span>
      </div>
      <div className="card reports-export-card">
        <div className="eyebrow" style={{ marginBottom: 8 }}>Portfolio CSV</div>
        <p className="reports-desc">
          Export all {projects.length} active PIDs with status, team, risk, and BGMV.
        </p>
        <CSVExportButton projects={projects} />
      </div>
    </>
  )
}
