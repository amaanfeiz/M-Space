import { createClient } from '@/lib/supabase/server'
import { TeamView } from '@/components/team/TeamView'
import { groupProjectsByTeam, TEAMS } from '@/lib/static/teams_static'
import type { ProjectAssignment } from '@/lib/static/teams_static'
import type { BriefJSON } from '@/components/intelligence/BriefBody'
import { ALL_AMAAN_PIDS } from '@/lib/static/all_pids'
import { Users } from 'lucide-react'

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ team?: string }> }) {
  const supabase = await createClient()
  const params = await searchParams
  const teamId = params.team

  const pidList = [...ALL_AMAAN_PIDS]
  const [{ data: projectRows }, { data: briefRows }] = await Promise.all([
    supabase
      .from('projects')
      .select('pid, cx_name, planner, designer, project_manager, overall_pid_risk, bgmv, event_start_date, t_days, rm')
      .in('pid', pidList),
    supabase
      .from('briefs')
      .select('pid, brief_date, brief_json')
      .in('pid', pidList)
      .order('brief_date', { ascending: false })
      .limit(200),
  ])

  const projects: ProjectAssignment[] = projectRows ?? []

  type BriefSummary = { sentiment: string; daysSilent: number; briefDate: string }
  const briefMap = new Map<number, BriefSummary>()
  for (const b of briefRows ?? []) {
    if (briefMap.has(b.pid)) continue
    const j = b.brief_json as BriefJSON
    briefMap.set(b.pid, {
      sentiment: j?.client_pulse?.sentiment ?? '',
      daysSilent: j?.client_pulse?.days_silent ?? 0,
      briefDate: b.brief_date,
    })
  }

  const { teams, outliers, salesWip } = groupProjectsByTeam(projects)

  const teamPlanner = teamId ? TEAMS.find((t) => t.id === teamId)?.planner.name : null

  return (
    <>
      <div className="page-header">
        <div className="page-header-text">
          <h1>Team</h1>
          <p>4 destination teams · {projects.length} projects</p>
        </div>
        {teamId && teamPlanner && (
          <span className="page-header-badge" style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}>
            Filtered by {TEAMS.find((t) => t.id === teamId)?.label}
          </span>
        )}
      </div>
      {projects.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <Users />
            <div className="empty-state-title">No team data yet</div>
            <div className="empty-state-sub">Team assignments will appear once the tracker syncs.</div>
          </div>
        </div>
      ) : (
        <TeamView
          teams={teams}
          outliers={outliers}
          salesWip={salesWip}
          briefMap={briefMap}
          filterTeamId={teamId}
        />
      )}
    </>
  )
}
