export type TeamConfig = {
  id: string
  label: string
  code: string
  planner:  { name: string; initials: string }
  designer: { name: string | null; initials: string }
  pm:       { name: string | null; initials: string }
}

export const ROLE_COLOR = {
  planner:  '#7241BE',
  designer: '#EC4899',
  pm:       '#14B8A6',
} as const

export const TEAMS: TeamConfig[] = [
  {
    id: 'bhavika', label: 'Team BSV', code: 'BSV',
    planner:  { name: 'Bhavika Gurnani',    initials: 'BG' },
    designer: { name: 'Shreyanshu Tiwari',  initials: 'ST' },
    pm:       { name: 'Varun Mittal',       initials: 'VM' },
  },
  {
    id: 'tapasya', label: 'Team TSN', code: 'TSN',
    planner:  { name: 'Tapasya Waldia',     initials: 'TW' },
    designer: { name: 'Somila Bhadauriya',  initials: 'SB' },
    pm:       { name: 'Nikhil Gupta',       initials: 'NG' },
  },
  {
    id: 'anant', label: 'Team A', code: 'A',
    planner:  { name: 'Ananth Santhosh',    initials: 'AN' },
    designer: { name: null,                 initials: '?' },
    pm:       { name: null,                 initials: '?' },
  },
  {
    id: 'aditya', label: 'Team AJN', code: 'AJN',
    planner:  { name: 'Aditya Sharma',      initials: 'AS' },
    designer: { name: 'Jaishree Patel',     initials: 'JP' },
    pm:       { name: 'Narendra Singh',     initials: 'NS' },
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
  t_days: number | null
  rm: string | null
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
  salesWip: ProjectAssignment[]
} {
  const teams: TeamGroup[] = TEAMS.map((team) => ({
    team,
    projects: [],
    bgmvTotal: 0,
    fullCount: 0,
    partialCount: 0,
  }))

  const outliers: ProjectAssignment[] = []
  const salesWip: ProjectAssignment[] = []

  for (const p of projects) {
    if (!p.planner) { salesWip.push(p); continue }
    const team = teams.find((t) => t.team.planner.name === p.planner)
    if (!team) { outliers.push(p); continue }
    const designerMatches = team.team.designer.name === null || team.team.designer.name === p.designer
    const pmMatches = team.team.pm.name === null || team.team.pm.name === p.project_manager
    const coverage: 'full' | 'partial' = designerMatches && pmMatches ? 'full' : 'partial'
    team.projects.push({ ...p, coverage })
    team.bgmvTotal += p.bgmv ?? 0
    if (coverage === 'full') team.fullCount += 1
    else team.partialCount += 1
  }

  return { teams, outliers, salesWip }
}
