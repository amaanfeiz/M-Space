export type TeamConfig = {
  id: string
  label: string
  planner: { name: string; initials: string; color: string }
  designer: { name: string | null; initials: string; color: string }
  pm: { name: string | null; initials: string; color: string }
}

export const TEAMS: TeamConfig[] = [
  {
    id: 'bhavika',
    label: 'Team Bhavika',
    planner: { name: 'Bhavika Gurnani', initials: 'BG', color: '#7241BE' },
    designer: { name: 'Shreyanshu Tiwari', initials: 'ST', color: '#8B5CF6' },
    pm: { name: 'Varun Mittal', initials: 'VM', color: '#14B8A6' },
  },
  {
    id: 'tapasya',
    label: 'Team Tapasya',
    planner: { name: 'Tapasya Waldia', initials: 'TW', color: '#7241BE' },
    designer: { name: 'Somila Bhadauriya', initials: 'SB', color: '#EC4899' },
    pm: { name: 'Nikhil Gupta', initials: 'NG', color: '#14B8A6' },
  },
  {
    id: 'anant',
    label: 'Team Anant',
    planner: { name: 'Ananth Santhosh', initials: 'AN', color: '#7241BE' },
    designer: { name: null, initials: '?', color: '#A09890' },
    pm: { name: null, initials: '?', color: '#A09890' },
  },
  {
    id: 'aditya',
    label: 'Team Aditya',
    planner: { name: 'Aditya Sharma', initials: 'AS', color: '#F59E0B' },
    designer: { name: 'Jaishree Patel', initials: 'JP', color: '#EC4899' },
    pm: { name: 'Narendra Singh', initials: 'NS', color: '#14B8A6' },
  },
]

export type ProjectAssignment = {
  pid: number
  cx_name: string | null
  planner: string | null
  designer: string | null
  project_manager: string | null
  overall_pid_risk: string | null
  bgmv: number | null
  event_start_date: string | null
}

export type TeamProject = ProjectAssignment & { coverage: 'full' | 'partial' }

export type TeamGroup = {
  team: TeamConfig
  projects: TeamProject[]
  bgmvTotal: number
  fullCount: number
  partialCount: number
}

export function groupProjectsByTeam(projects: ProjectAssignment[]): {
  teams: TeamGroup[]
  outliers: ProjectAssignment[]
} {
  const teams: TeamGroup[] = TEAMS.map((team) => ({
    team,
    projects: [],
    bgmvTotal: 0,
    fullCount: 0,
    partialCount: 0,
  }))

  const outliers: ProjectAssignment[] = []

  for (const p of projects) {
    const team = teams.find((t) => t.team.planner.name === p.planner)
    if (!team) {
      outliers.push(p)
      continue
    }
    const designerMatches = team.team.designer.name === null || team.team.designer.name === p.designer
    const pmMatches = team.team.pm.name === null || team.team.pm.name === p.project_manager
    const coverage: 'full' | 'partial' = designerMatches && pmMatches ? 'full' : 'partial'
    team.projects.push({ ...p, coverage })
    team.bgmvTotal += p.bgmv ?? 0
    if (coverage === 'full') team.fullCount += 1
    else team.partialCount += 1
  }

  return { teams, outliers }
}
