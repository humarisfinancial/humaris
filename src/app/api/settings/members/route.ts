import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { permissions } from '@/lib/rbac/permissions'
import { getMembers } from '@/lib/settings/members'

export const runtime = 'nodejs'

export async function GET() {
  const session = await requireSession()
  try {
    if (!session.org) {
      return NextResponse.json({ error: 'No organization context' }, { status: 400 })
    }
    if (!permissions.settings.viewOrg(session.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }
    const members = await getMembers(session.org.id)
    return NextResponse.json({ members })
  } catch {
    return NextResponse.json({ error: 'Failed to load members' }, { status: 500 })
  }
}
