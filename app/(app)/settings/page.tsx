import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SignOutButton } from '@/components/settings/SignOutButton'

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, color: 'var(--text-primary)', marginBottom: 4 }}>
        Settings
      </div>
      <div className="card" style={{ maxWidth: 480 }}>
        <div className="eyebrow" style={{ marginBottom: 16 }}>Account</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 80 }}>Email</div>
            <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{user.email}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 80 }}>Role</div>
            <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>Team Lead</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 80 }}>Access</div>
            <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>Phase 1 — read only</div>
          </div>
        </div>
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
          <SignOutButton />
        </div>
      </div>
    </>
  )
}
