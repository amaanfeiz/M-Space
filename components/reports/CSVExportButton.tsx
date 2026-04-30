'use client'

type ProjectRow = {
  pid: number
  cx_name: string | null
  status: string | null
  planner: string | null
  designer: string | null
  project_manager: string | null
  event_start_date: string | null
  overall_pid_risk: string | null
  bgmv: number | null
  collection: number | null
  collection_pct: number | null
  venue: string | null
  state: string | null
  synced_at: string | null
}

export function CSVExportButton({ projects }: { projects: ProjectRow[] }) {
  function download() {
    const headers = ['PID', 'Couple', 'Status', 'Planner', 'Designer', 'PM', 'Event Date', 'Risk', 'BGMV', 'Collection', 'Collection %', 'Venue', 'State']
    const rows = projects.map((p) => [
      p.pid,
      (p.cx_name ?? '').replace(/,/g, ' '),
      p.status ?? '',
      p.planner ?? '',
      p.designer ?? '',
      p.project_manager ?? '',
      p.event_start_date ?? '',
      p.overall_pid_risk ?? '',
      p.bgmv ?? '',
      p.collection ?? '',
      p.collection_pct?.toFixed(1) ?? '',
      (p.venue ?? '').replace(/,/g, ' '),
      p.state ?? '',
    ])
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `meragi-portfolio-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button className="btn-primary" onClick={download} type="button" style={{ maxWidth: 200 }}>
      Download CSV
    </button>
  )
}
