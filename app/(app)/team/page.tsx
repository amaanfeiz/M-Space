import { createClient } from '@/lib/supabase/server'
import { TeamView } from '@/components/team/TeamView'
import { groupProjectsByTeam } from '@/lib/static/teams_static'
import type { ProjectAssignment } from '@/lib/static/teams_static'
import { Users } from 'lucide-react'

export default async function TeamPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('projects')
    .select('pid, cx_name, planner, designer, project_manager, overall_pid_risk, bgmv, event_start_date')

  const projects: ProjectAssignment[] = data ?? []
  const { teams, outliers } = groupProjectsByTeam(projects)

  return (
    <>
      <div className="page-header">
        <div className="page-header-text">
          <h1>Team</h1>
          <p>4 destination teams · {projects.length} projects</p>
        </div>
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
        <TeamView teams={teams} outliers={outliers} />
      )}
    </>
  )
}
