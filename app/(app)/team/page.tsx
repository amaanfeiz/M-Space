import { createClient } from '@/lib/supabase/server'
import { TeamView } from '@/components/team/TeamView'
import { groupProjectsByTeam } from '@/lib/static/teams_static'
import type { ProjectAssignment } from '@/lib/static/teams_static'

export default async function TeamPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('projects')
    .select(
      'pid, cx_name, planner, designer, project_manager, overall_pid_risk, bgmv, event_start_date',
    )

  const projects: ProjectAssignment[] = data ?? []
  const { teams, outliers } = groupProjectsByTeam(projects)

  return <TeamView teams={teams} outliers={outliers} />
}
