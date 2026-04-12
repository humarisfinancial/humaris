import { NextResponse, type NextRequest } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { permissions } from '@/lib/rbac/permissions'
import { updateMemberRole, removeMember } from '@/lib/settings/members'
import type { OrgRole } from '@/types'

export const runtime = 'nodejs'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  try {
    const { id } = await params
    if (!session.org) {
      return NextResponse.json({ error: 'No organization context' }, { status: 400 })
    }

    const body = await request.json()
    const role = body.role as OrgRole

    if (!role) {
      return NextResponse.json({ error: 'role is required' }, { status: 400 })
    }

    if (role === 'owner' && !permissions.settings.manageRoles(session.role)) {
      return NextResponse.json({ error: 'Only owners can assign the owner role' }, { status: 403 })
    }

    if (role !== 'owner' && !permissions.settings.manageUsers(session.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    await updateMemberRole(session.org.id, id, role)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to update role' }, { status: 500 })
  }
}

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
    await removeMember(session.org.id, id)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    if (err instanceof Error && err.message === 'LAST_OWNER') {
      return NextResponse.json({ error: 'Cannot remove the last owner' }, { status: 400 })
    }
    if (err instanceof Error && err.message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 })
  }
}
