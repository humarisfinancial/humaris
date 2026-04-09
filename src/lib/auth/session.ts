import { createServerSupabaseClient } from '@/lib/db/server'
import { redirect } from 'next/navigation'
import type { SessionUser } from '@/types'

/**
 * Get the current authenticated session user with org context.
 * Call this at the top of Server Components and Route Handlers.
 *
 * Redirects to /login if not authenticated.
 * Redirects to /onboarding if authenticated but no org.
 */
export async function requireSession(orgSlug?: string): Promise<SessionUser> {
  const supabase = await createServerSupabaseClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  // Get user profile
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    redirect('/login')
  }

  // Super admins skip org requirement
  if (profile.is_super_admin && !orgSlug) {
    return {
      id: user.id,
      email: user.email!,
      profile,
      org: null as any,
      role: 'owner',
      is_super_admin: true,
    }
  }

  // Get org membership
  const orgQuery = supabase
    .from('org_members')
    .select('role, organizations(*)')
    .eq('user_id', user.id)

  if (orgSlug) {
    orgQuery.eq('organizations.slug', orgSlug)
  }

  const { data: memberships } = await orgQuery.limit(1).single()

  if (!memberships) {
    redirect('/onboarding')
  }

  const org = Array.isArray(memberships.organizations)
    ? memberships.organizations[0]
    : memberships.organizations

  if (!org) {
    redirect('/onboarding')
  }

  return {
    id: user.id,
    email: user.email!,
    profile,
    org,
    role: memberships.role,
    is_super_admin: profile.is_super_admin,
  }
}

/**
 * Get session without redirecting — returns null if not authenticated.
 * Use in layouts/components where auth is optional.
 */
export async function getSession(): Promise<SessionUser | null> {
  try {
    return await requireSession()
  } catch {
    return null
  }
}
