import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SignOutButton } from '@/components/settings/SignOutButton'
import { CSVExportButton } from '@/components/reports/CSVExportButton'

// Anthropic pricing for claude-haiku-4-5 in USD per 1M tokens.
const HAIKU_INPUT_USD_PER_M = 1.00
const HAIKU_OUTPUT_USD_PER_M = 5.00
// Treat ~₹84/USD as the conversion. Matches generate-brief.ts cost summary.
const INR_PER_USD = 84

function monthStart(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
}

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Month-to-date brief generation cost
  const [{ data: usageRows }, { data: reportRows }] = await Promise.all([
    supabase
      .from('briefs')
      .select('input_tokens, output_tokens')
      .gte('created_at', monthStart()),
    supabase
      .from('projects')
      .select('pid, cx_name, status, planner, designer, project_manager, event_start_date, overall_pid_risk, bgmv, collection, collection_pct, venue, state, synced_at'),
  ])

  let inputTokens = 0
  let outputTokens = 0
  for (const r of usageRows ?? []) {
    inputTokens += r.input_tokens ?? 0
    outputTokens += r.output_tokens ?? 0
  }
  const usd = (inputTokens / 1_000_000) * HAIKU_INPUT_USD_PER_M
    + (outputTokens / 1_000_000) * HAIKU_OUTPUT_USD_PER_M
  const inr = Math.round(usd * INR_PER_USD)
  const briefsThisMonth = usageRows?.length ?? 0
  const reportProjects = reportRows ?? []

  return (
    <>
      <div className="page-header">
        <div className="page-header-text">
          <h1>Settings</h1>
          <p>Account and application preferences.</p>
        </div>
      </div>
      <div className="card" style={{ maxWidth: 480, padding: '20px 24px' }}>
        <div className="eyebrow" style={{ marginBottom: 16 }}>Account</div>
        <div>
          <div className="settings-field">
            <span className="settings-label">Email</span>
            <span className="settings-value">{user.email}</span>
          </div>
          <div className="settings-field">
            <span className="settings-label">Role</span>
            <span className="settings-value">Team Lead</span>
          </div>
          <div className="settings-field">
            <span className="settings-label">Access</span>
            <span className="settings-value">Phase 1 — read only</span>
          </div>
        </div>
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
          <SignOutButton />
        </div>
      </div>

      <div className="card" style={{ maxWidth: 480, padding: '20px 24px', marginTop: 16 }}>
        <div className="eyebrow" style={{ marginBottom: 16 }}>Anthropic usage · this month</div>
        <div className="settings-field">
          <span className="settings-label">Briefs generated</span>
          <span className="settings-value" style={{ fontFamily: 'var(--font-mono)' }}>{briefsThisMonth}</span>
        </div>
        <div className="settings-field">
          <span className="settings-label">Input tokens</span>
          <span className="settings-value" style={{ fontFamily: 'var(--font-mono)' }}>{inputTokens.toLocaleString('en-IN')}</span>
        </div>
        <div className="settings-field">
          <span className="settings-label">Output tokens</span>
          <span className="settings-value" style={{ fontFamily: 'var(--font-mono)' }}>{outputTokens.toLocaleString('en-IN')}</span>
        </div>
        <div className="settings-field">
          <span className="settings-label">Est. cost</span>
          <span className="settings-value" style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
            ${usd.toFixed(2)} · ~₹{inr.toLocaleString('en-IN')}
          </span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 8, lineHeight: 1.55 }}>
          Haiku 4.5 — ${HAIKU_INPUT_USD_PER_M.toFixed(2)}/M input · ${HAIKU_OUTPUT_USD_PER_M.toFixed(2)}/M output. INR estimated at ₹{INR_PER_USD}/USD.
        </div>
      </div>

      <div className="card" style={{ maxWidth: 480, padding: '20px 24px', marginTop: 16 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Portfolio CSV</div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
          Export all {reportProjects.length} active PIDs with status, team, risk, and BGMV.
        </p>
        <CSVExportButton projects={reportProjects} />
      </div>
    </>
  )
}
