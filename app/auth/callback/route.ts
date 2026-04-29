import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

// PHASE-1.5: replace with users table allowlist
const PHASE1_ALLOWLIST = ['amaan.kader@meragi.com']

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`)
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  const { data: { user } } = await supabase.auth.getUser()
  const email = user?.email ?? ''

  if (!email.endsWith('@meragi.com')) {
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/login?error=wrong_domain`)
  }

  // PHASE-1.5: replace with users table allowlist
  if (!PHASE1_ALLOWLIST.includes(email)) {
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/login?error=phase1_only`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
