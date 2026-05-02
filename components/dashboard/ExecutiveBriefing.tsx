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
    .filter((p) => p.overall_pid_risk === 'Critical' || p.overall_pid_risk === 'Attention')
    .slice(0, 3)

  let text = `Portfolio: ${live} active projects, ${totalBgmv} total BGMV.`
  if (criticalCount > 0) text += ` ${criticalCount} critical ${criticalCount === 1 ? 'risk' : 'risks'}.`
  if (attentionCount > 0) text += ` ${attentionCount} attention-level ${attentionCount === 1 ? 'item' : 'items'}.`
  if (topRisks.length > 0) {
    text += ' Top priority: ' + topRisks.map((p) => {
      const summary = p.current_summary?.split('.')[0] ?? ''
      return `PID ${p.pid}${summary ? ` — ${summary}` : ''}`
    }).join('. ') + '.'
  }
  return text
}

export function ExecutiveBriefing({ projects, criticalCount, attentionCount, totalBgmv, eyebrow }: ExecutiveBriefingProps) {
  const briefing = buildBriefing(projects, criticalCount, attentionCount, totalBgmv)
  const urgencyLevel = criticalCount > 0 ? 'critical' : attentionCount > 0 ? 'attention' : 'healthy'

  return (
    <div className={`briefing-hero briefing-hero--${urgencyLevel}`}>
      <div className="briefing-hero-accent" aria-hidden />
      <div className="briefing-hero-content">
        <div className="briefing-hero-eyebrow">
          <span className="panel-ai-dot" aria-hidden />
          {eyebrow}
        </div>
        <p className="briefing-hero-body">{briefing}</p>
      </div>
      <div className="briefing-hero-badges">
        {criticalCount > 0 && (
          <span className="health-chip critical">{criticalCount} critical</span>
        )}
        {attentionCount > 0 && (
          <span className="health-chip attention">{attentionCount} attention</span>
        )}
        {criticalCount === 0 && attentionCount === 0 && (
          <span className="health-chip healthy">All clear</span>
        )}
      </div>
    </div>
  )
}
