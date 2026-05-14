import { createClient } from '@/lib/supabase/server'
import { IntelligenceList, type BriefItem } from '@/components/intelligence/IntelligenceList'
import type { BriefJSON } from '@/components/intelligence/BriefCard'

const ALL_AMAAN_PIDS = [
  24292, 28172, 33798, 19935, 20614, 24202, 24401, 25210, 26903, 30646,
  30969, 32125, 29662, 32245, 33487, 31341, 23671, 28438, 28166, 29568,
  28698, 21491, 33797, 28625, 30731, 33673, 33565, 31574, 33313, 33867, 34002,
]

interface BriefRow {
  id: string
  pid: number
  brief_date: string
  is_catchup: boolean
  brief_json: BriefJSON
}

interface ProjectRow {
  pid: number
  cx_name: string | null
  event_start_date: string | null
  event_end_date: string | null
  t_days: number | null
  collection_pct: string | null
  project_health: number | null
  planner: string | null
  rm: string | null
}

export default async function IntelligencePage() {
  const supabase = await createClient()

  const { data: allBriefs } = await supabase
    .from('briefs')
    .select('id, pid, brief_date, is_catchup, brief_json')
    .in('pid', ALL_AMAAN_PIDS)
    .order('brief_date', { ascending: false })
    .limit(200)

  const { data: projects } = await supabase
    .from('projects')
    .select('pid, cx_name, event_start_date, event_end_date, t_days, collection_pct, project_health, planner, rm')
    .in('pid', ALL_AMAAN_PIDS)

  // Deduplicate briefs — keep latest per PID
  const latestByPid = new Map<number, BriefRow>()
  for (const b of (allBriefs ?? []) as BriefRow[]) {
    if (!latestByPid.has(b.pid)) latestByPid.set(b.pid, b)
  }

  const projectByPid = new Map<number, ProjectRow>()
  for (const p of (projects ?? []) as ProjectRow[]) {
    projectByPid.set(p.pid, p)
  }

  // PIDs with no planner = Sales WIP regardless of whether they have an old brief
  const wipPids = new Set(
    [...projectByPid.values()].filter((p) => !p.planner).map((p) => p.pid)
  )

  // Merge into flat items — brief cards for non-WIP PIDs only
  const items: BriefItem[] = [...latestByPid.values()]
    .filter((b) => !wipPids.has(b.pid))
    .map((b) => {
      const p = projectByPid.get(b.pid)
      return {
        id: b.id,
        pid: b.pid,
        briefDate: b.brief_date,
        isCatchup: b.is_catchup,
        brief: b.brief_json,
        cxName: p?.cx_name ?? null,
        eventStart: p?.event_start_date ?? null,
        eventEnd: p?.event_end_date ?? null,
        tDays: p?.t_days ?? null,
        collectionPct: p?.collection_pct ?? null,
        projectHealth: p?.project_health ?? null,
        isSalesWip: false,
        rm: p?.rm ?? null,
      }
    })

  // Sales WIP placeholder for every no-planner PID in the list
  for (const pid of ALL_AMAAN_PIDS) {
    if (!wipPids.has(pid)) continue
    const p = projectByPid.get(pid)
    if (!p) continue
    items.push({
      id: `wip-${pid}`,
      pid,
      briefDate: '',
      isCatchup: false,
      brief: null,
      cxName: p.cx_name ?? null,
      eventStart: p.event_start_date ?? null,
      eventEnd: p.event_end_date ?? null,
      tDays: p.t_days ?? null,
      collectionPct: p.collection_pct ?? null,
      projectHealth: p.project_health ?? null,
      isSalesWip: true,
      rm: p.rm ?? null,
    })
  }

  // Sentiment summary counts (independent of sort order)
  const sentimentCounts = items.reduce<Record<string, number>>((acc, b) => {
    const s = b.brief?.client_pulse?.sentiment ?? 'unknown'
    acc[s] = (acc[s] ?? 0) + 1
    return acc
  }, {})

  const latestDate = allBriefs?.[0]?.brief_date ?? null

  return (
    <>
      <div className="page-header">
        <div className="page-header-text">
          <h1>Intelligence</h1>
          <p>AI briefs per PID.{latestDate && ` Last generated ${latestDate}.`}</p>
        </div>
        <span className="page-header-badge">{items.filter(i => !i.isSalesWip).length} briefs</span>
      </div>

      {/* Sentiment summary bar */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        {(['cold', 'anxious', 'cautious', 'neutral', 'positive'] as const).map((s) => {
          const n = sentimentCounts[s] ?? 0
          if (n === 0) return null
          const colors: Record<string, string> = {
            cold: 'var(--critical)', anxious: 'var(--critical)',
            cautious: 'var(--attention)', neutral: 'var(--text-dim)', positive: 'var(--healthy)',
          }
          return (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: colors[s], display: 'inline-block' }} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {n} {s}
              </span>
            </div>
          )
        })}
      </div>

      <IntelligenceList items={items} />
      <div style={{ height: 24 }} />
    </>
  )
}
