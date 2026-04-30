export type Project = {
  pid: number
  cx_name: string | null
  status: string | null
  communication_days: number | null
  overall_pid_risk: string | null
  cancellation_risk: number | null
  current_summary: string | null
  bgmv: number | null
  collection_pct: number | null
  event_start_date: string | null
  planner: string | null
  project_health: number | null
  venue: string | null
  state: string | null
  last_message_date: string | null
  synced_at: string | null
}

export type RiskLevel = 'Critical' | 'Attention' | 'Healthy'

export const RISK_ORDER: Record<string, number> = {
  Critical: 0,
  Attention: 1,
  Healthy: 2,
}

export function formatCouple(cx_name: string | null): string {
  if (!cx_name) return '—'
  return cx_name.replace(' & ', ' · ')
}

export function formatInr(amount: number | null): string {
  if (!amount) return '—'
  if (amount >= 10_000_000)
    return `₹${(amount / 10_000_000).toFixed(2).replace(/\.?0+$/, '')}Cr`
  if (amount >= 100_000)
    return `₹${(amount / 100_000).toFixed(1).replace(/\.0$/, '')}L`
  return `₹${amount.toLocaleString('en-IN')}`
}

export function riskDotClass(riskLevel: string | null): string {
  if (riskLevel === 'Critical') return 'dot-critical'
  if (riskLevel === 'Attention') return 'dot-attention'
  return 'dot-healthy'
}

export function sparklineColor(riskLevel: string | null): string {
  if (riskLevel === 'Critical') return '#EF4444'
  if (riskLevel === 'Attention') return '#F59E0B'
  return '#22C55E'
}

export function flatSparkline(cancellationRisk: number | null): string {
  const risk = cancellationRisk ?? 2
  const y = Math.round(16 - (risk / 5) * 14)
  return `2,${y} 10,${y} 18,${y} 26,${y} 34,${y} 42,${y} 50,${y} 58,${y}`
}
