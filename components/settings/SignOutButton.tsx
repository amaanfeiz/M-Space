'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export function SignOutButton() {
  const router = useRouter()

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <button
      className="btn-secondary"
      onClick={signOut}
      type="button"
      style={{ maxWidth: 120 }}
    >
      Sign out
    </button>
  )
}
