import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { User } from '@supabase/supabase-js'

/**
 * Dev-only auth bypass. Gated on BOTH NODE_ENV === 'development' AND
 * BYPASS_AUTH === '1' so a leaked env var on Vercel never opens the gate.
 * Pair with the matching guard in `proxy.ts`.
 */
function isAuthBypassed(): boolean {
  return process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === '1'
}

const BYPASS_USER = {
  id: '00000000-0000-0000-0000-000000000000',
  email: 'amaan.kader@meragi.com',
  app_metadata: {},
  user_metadata: { name: 'Amaan Abdul Kader' },
  aud: 'authenticated',
  created_at: new Date(0).toISOString(),
} as unknown as User

export async function createClient() {
  const cookieStore = await cookies()

  // In dev-bypass mode use service_role so RLS-protected reads succeed
  // without a real session. Service_role key MUST stay in .env.local and
  // never be shipped to the client — this code only runs server-side.
  const bypass = isAuthBypassed()
  const apiKey = bypass && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? process.env.SUPABASE_SERVICE_ROLE_KEY
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    apiKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component — proxy handles session refresh
          }
        },
      },
    }
  )

  if (bypass) {
    // Replace auth.getUser with a stub that returns the BYPASS_USER so pages
    // don't redirect to /login. Data reads use service_role above to clear RLS.
    client.auth.getUser = async () => ({
      data: { user: BYPASS_USER },
      error: null,
    })
  }

  return client
}
