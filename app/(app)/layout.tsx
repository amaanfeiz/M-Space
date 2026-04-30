import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/shell/Sidebar'
import { Topbar } from '@/components/shell/Topbar'
import { DetailPanel } from '@/components/panel/DetailPanel'
import { createClient } from '@/lib/supabase/server'

function userDisplayFromEmail(email: string) {
  const local = email.split('@')[0] ?? ''
  const parts = local.split('.').filter(Boolean)
  const name = parts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
  const initials =
    parts
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join('') || 'U'
  return { name: name || email, initials }
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    redirect('/login')
  }

  const { name, initials } = userDisplayFromEmail(user.email)

  // Read last sync time
  const { data: syncLog } = await supabase
    .from('sync_log')
    .select('created_at')
    .eq('status', 'success')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const syncedAt = syncLog?.created_at ?? null

  return (
    <>
      <Sidebar userName={name} userInitials={initials} userRole="Team Lead" />
      <div id="main">
        <Topbar syncedAt={syncedAt} />
        <div id="content">
          <div className="view-container">{children}</div>
        </div>
      </div>
      <DetailPanel />
    </>
  )
}
