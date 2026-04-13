import { NextResponse, type NextRequest } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { permissions } from '@/lib/rbac/permissions'
import { revokeInvitation } from '@/lib/settings/invitations'

export const runtime = 'nodejs'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  try {
    const { id } = await params
    if (!session.org) {
      return NextResponse.json({ error: 'No organization context' }, { status: 400 })
    }
    if (!permissions.settings.manageUsers(session.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }
    await revokeInvitation(session.org.id, id)
    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json({ error: 'Failed to revoke invitation' }, { status: 500 })
  }
}
