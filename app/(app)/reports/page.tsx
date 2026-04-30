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
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, color: 'var(--text-primary)', marginBottom: 4 }}>
        Reports
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
        Portfolio exports — Phase 1.
      </div>
      <div className="card" style={{ maxWidth: 480 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Portfolio CSV</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          Export all {projects.length} active PIDs with status, team, risk, and BGMV.
        </div>
        <CSVExportButton projects={projects} />
      </div>
    </>
  )
}
