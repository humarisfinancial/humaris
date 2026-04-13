import { NextResponse, type NextRequest } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { permissions } from '@/lib/rbac/permissions'
import { createServerSupabaseClient } from '@/lib/db/server'

export const runtime = 'nodejs'

export async function PATCH(request: NextRequest) {
  const session = await requireSession()
  try {
    if (!session.org) {
      return NextResponse.json({ error: 'No organization context' }, { status: 400 })
    }
    if (!permissions.settings.configureFinancials(session.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const name: string = body.name?.trim() ?? ''

    if (!name || name.length > 100) {
      return NextResponse.json(
        { error: 'Organization name must be between 1 and 100 characters' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()
    const { error } = await supabase
      .from('organizations')
      .update({ name, updated_at: new Date().toISOString() })
      .eq('id', session.org.id)

    if (error) throw new Error(error.message)

    return NextResponse.json({ name })
  } catch {
    return NextResponse.json({ error: 'Failed to update organization' }, { status: 500 })
  }
}
