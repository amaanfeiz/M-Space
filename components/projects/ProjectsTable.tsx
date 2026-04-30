'use client'

import { formatCouple, formatInr, riskDotClass } from '@/lib/types/project'

type Row = {
  pid: number
  cx_name: string | null
  status: string | null
  planner: string | null
  designer: string | null
  project_manager: string | null
  event_start_date: string | null
  overall_pid_risk: string | null
  bgmv: number | null
  region: string | null
  state: string | null
  city: string | null
}

const TBA = (v: string | null | undefined) => (v && v.trim() ? v : 'TBA')

export function ProjectsTable({ projects }: { projects: Row[] }) {
  return (
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
            <tr
              key={p.pid}
              onClick={() => {
                window.location.hash = `#pid=${p.pid}`
              }}
              style={{ cursor: 'pointer' }}
            >
              <td
                style={{
                  color: 'var(--text-primary)',
                  fontFamily: "'Courier New', monospace",
                }}
              >
                {p.pid}
              </td>
              <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                {formatCouple(p.cx_name)}
              </td>
              <td>{TBA(p.state ?? p.city)}</td>
              <td>{TBA(p.planner)}</td>
              <td>{TBA(p.designer)}</td>
              <td>{TBA(p.project_manager)}</td>
              <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                {p.event_start_date
                  ? new Date(p.event_start_date).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: '2-digit',
                    })
                  : 'TBA'}
              </td>
              <td>
                <span
                  className={`status-dot ${riskDotClass(p.overall_pid_risk)}`}
                  style={{ marginRight: 6 }}
                />
                {p.overall_pid_risk ?? 'TBA'}
              </td>
              <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatInr(p.bgmv)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
