import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SignOutButton } from '@/components/settings/SignOutButton'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

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
    </>
  )
}
