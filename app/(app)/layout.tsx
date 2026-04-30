import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/shell/Sidebar'
import { Topbar } from '@/components/shell/Topbar'
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

  return (
    <>
      <Sidebar userName={name} userInitials={initials} userRole="Team Lead" />
      <div id="main">
        <Topbar />
        <div id="content">
          <div className="view-container">{children}</div>
        </div>
      </div>
    </>
  )
}
