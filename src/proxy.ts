import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Middleware — runs on every request.
 * Refreshes the Supabase session cookie and protects routes.
 */
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — required for Server Components to pick up updated tokens
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Public routes — no auth required
  const publicRoutes = ['/login', '/signup', '/auth/callback']
  const isPublicRoute = publicRoutes.some(r => pathname.startsWith(r))

  // Redirect unauthenticated users to login
  if (!user && !isPublicRoute) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Redirect authenticated users away from auth pages
  if (user && isPublicRoute) {
    const appUrl = request.nextUrl.clone()
    appUrl.pathname = '/dashboard'
    appUrl.searchParams.delete('redirectTo')
    return NextResponse.redirect(appUrl)
  }

  // Admin routes — check super_admin flag via profile
  if (pathname.startsWith('/admin') && user) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_super_admin) {
      const notFoundUrl = request.nextUrl.clone()
      notFoundUrl.pathname = '/dashboard'
      return NextResponse.redirect(notFoundUrl)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
