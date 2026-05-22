import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Dev-only auth bypass. Gated on BOTH NODE_ENV === 'development' AND
 * BYPASS_AUTH === '1' so a leaked env var on Vercel never opens the gate.
 * Pair with the matching guard in `lib/supabase/server.ts`.
 */
function isAuthBypassed(): boolean {
  return process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === '1'
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  if (isAuthBypassed()) {
    return supabaseResponse
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { pathname } = request.nextUrl

  if (pathname.startsWith('/login') || pathname.startsWith('/auth')) {
    return supabaseResponse
  }

  // Fast cookie-based session check (no network roundtrip).
  // getUser() is reserved for the auth callback where we actually
  // need to validate the token against the auth server.
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
