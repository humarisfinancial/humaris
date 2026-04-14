import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/db/server'
import { redirect } from 'next/navigation'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const name: string = body.name?.trim()

    if (!name || name.length < 1 || name.length > 100) {
      return NextResponse.json({ error: 'Organization name must be between 1 and 100 characters' }, { status: 400 })
    }

    // Generate slug from name
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      + '-' + Math.random().toString(36).slice(2, 6)

    const service = createServiceClient()

    // Create the organization
    const { data: org, error: orgError } = await service
      .from('organizations')
      .insert({ name, slug })
      .select('id')
      .single()

    if (orgError) throw new Error(orgError.message)

    // Add the user as owner
    const { error: memberError } = await service
      .from('org_members')
      .insert({ org_id: org.id, user_id: user.id, role: 'owner' })

    if (memberError) throw new Error(memberError.message)

    // Seed default chart of accounts
    await service.rpc('seed_default_chart_of_accounts', { p_org_id: org.id })

    return NextResponse.json({ orgId: org.id })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
