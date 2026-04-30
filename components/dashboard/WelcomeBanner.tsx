import type { Project } from '@/lib/types/project'
import { formatCouple } from '@/lib/types/project'

type WelcomeBannerProps = {
  userName: string
  userInitials: string
  topProjects: Project[]
}

function greetingFor(initials: string): string {
  const nowIst = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
  const hour = nowIst.getUTCHours()
  const timeOfDay =
    hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'
  const firstName = initials.charAt(0)
  return `Good ${timeOfDay}, ${firstName}.`
}

function summaryLine(p: Project): string {
  if (p.current_summary) {
    const sentence = p.current_summary.split('.')[0] ?? p.current_summary
    return `${p.pid} (${formatCouple(p.cx_name)}) — ${sentence}.`
  }
  return `${p.pid} (${formatCouple(p.cx_name)}) — ${p.overall_pid_risk ?? 'risk'} level.`
}

export function WelcomeBanner({
  userName,
  userInitials,
  topProjects,
}: WelcomeBannerProps) {
  const firstName = userName.split(' ')[0] ?? userName
  const greeting = greetingFor(firstName)

  const summaryText =
    topProjects.length === 0
      ? 'No critical items in your portfolio right now.'
      : `${topProjects.length} ${topProjects.length === 1 ? 'item needs' : 'things need'} you today: ${topProjects.map(summaryLine).join(' ')}`

  return (
    <div className="welcome-banner">
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: 'var(--accent-dim)',
          border: '1px solid rgba(114,65,190,0.20)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: 13,
          color: 'var(--accent)',
        }}
      >
        {userInitials}
      </div>
      <div>
        <div className="welcome-greeting">{greeting}</div>
        <div className="welcome-summary">{summaryText}</div>
      </div>
    </div>
  )
}
