import { createServerSupabaseClient } from '@/lib/db/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Supabase Auth callback — handles email confirmation and OAuth redirects.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const redirectTo = searchParams.get('redirectTo') ?? '/dashboard'

  if (code) {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(`${origin}${redirectTo}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
