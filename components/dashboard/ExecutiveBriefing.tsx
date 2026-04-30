import type { Project } from '@/lib/types/project'

type ExecutiveBriefingProps = {
  projects: Project[]
  criticalCount: number
  attentionCount: number
  totalBgmv: string
  eyebrow: string
}

function buildBriefing(
  projects: Project[],
  criticalCount: number,
  attentionCount: number,
  totalBgmv: string,
): string {
  const live = projects.length
  const topRisks = projects
    .filter(
      (p) =>
        p.overall_pid_risk === 'Critical' || p.overall_pid_risk === 'Attention',
    )
    .slice(0, 3)

  let text = `Portfolio: ${live} active projects, ${totalBgmv} total BGMV.`

  if (criticalCount > 0)
    text += ` ${criticalCount} critical ${criticalCount === 1 ? 'risk' : 'risks'}.`
  if (attentionCount > 0)
    text += ` ${attentionCount} attention-level ${attentionCount === 1 ? 'item' : 'items'}.`

  if (topRisks.length > 0) {
    text +=
      ' Top priority: ' +
      topRisks
        .map((p) => {
          const summary = p.current_summary?.split('.')[0] ?? ''
          return `PID ${p.pid}${summary ? ` — ${summary}` : ''}`
        })
        .join('. ') +
      '.'
  }

  return text
}

export function ExecutiveBriefing({
  projects,
  criticalCount,
  attentionCount,
  totalBgmv,
  eyebrow,
}: ExecutiveBriefingProps) {
  const briefing = buildBriefing(projects, criticalCount, attentionCount, totalBgmv)

  return (
    <div className="briefing-card fade-in" style={{ animationDelay: '0ms' }}>
      <div className="briefing-eyebrow">{eyebrow}</div>
      <p className="briefing-body">{briefing}</p>
      <span style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 12 }}>
        synced data
      </span>
    </div>
  )
}
