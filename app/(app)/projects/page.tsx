import { createClient } from '@/lib/supabase/server'
import { ProjectsTable } from '@/components/projects/ProjectsTable'
import { Layers } from 'lucide-react'

interface BriefSummary {
  sentiment: string
  flags: number
  actions: number
}

const SENTIMENT_LABEL: Array<keyof typeof SENTIMENT_COLOR> = [
  'cold', 'anxious', 'cautious', 'neutral', 'positive',
]
const SENTIMENT_COLOR = {
  cold: 'var(--critical)',
  anxious: 'var(--critical)',
  cautious: 'var(--attention)',
  neutral: 'var(--text-dim)',
  positive: 'var(--healthy)',
} as const

export default async function ProjectsPage() {
  const supabase = await createClient()

  const [{ data }, { data: briefRows }] = await Promise.all([
    supabase
      .from('projects')
      .select('pid, cx_name, status, planner, designer, project_manager, event_start_date, t_days, overall_pid_risk, bgmv, collection_pct, region, state, city')
      .order('event_start_date', { ascending: true }),
    supabase
      .from('briefs')
      .select('pid, brief_date, brief_json')
      .order('brief_date', { ascending: false })
      .limit(200),
  ])

  const projects = data ?? []

  // Latest brief per PID. "Actions" rolls up urgent items the user is on
  // the hook for: needs_you + unacknowledged_requests. Cross-source flags
  // remain a separate count since they describe data discrepancies, not
  // an action queue.
  const briefMap = new Map<number, BriefSummary>()
  for (const b of briefRows ?? []) {
    if (briefMap.has(b.pid)) continue
    const j = b.brief_json as {
      client_pulse?: { sentiment?: string }
      cross_source_flags?: unknown[]
      needs_you?: unknown[]
      unacknowledged_requests?: unknown[]
    }
    briefMap.set(b.pid, {
      sentiment: j?.client_pulse?.sentiment ?? '',
      flags: j?.cross_source_flags?.length ?? 0,
      actions: (j?.needs_you?.length ?? 0) + (j?.unacknowledged_requests?.length ?? 0),
    })
  }

  // Sentiment counts for the header summary bar.
  const sentimentCounts: Record<string, number> = {}
  for (const b of briefMap.values()) {
    if (!b.sentiment) continue
    sentimentCounts[b.sentiment] = (sentimentCounts[b.sentiment] ?? 0) + 1
  }

  const latestBriefDate = briefRows?.[0]?.brief_date ?? null
  const briefCount = briefMap.size

  return (
    <>
      <div className="page-header">
        <div className="page-header-text">
          <h1>Projects</h1>
          <p>
            {projects.length} PIDs · sorted by event date
            {latestBriefDate && ` · briefs generated ${latestBriefDate}`}
          </p>
        </div>
        <span className="page-header-badge">{briefCount} briefs</span>
      </div>

      {/* Sentiment summary bar */}
      {briefCount > 0 && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
          {SENTIMENT_LABEL.map((s) => {
            const n = sentimentCounts[s] ?? 0
            if (n === 0) return null
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: SENTIMENT_COLOR[s], display: 'inline-block',
                }} />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {n} {s}
                </span>
              </div>
            )
          })}
        </div>
      )}

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
