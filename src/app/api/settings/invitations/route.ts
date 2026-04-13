import { NextResponse, type NextRequest } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { permissions } from '@/lib/rbac/permissions'
import { getPendingInvitations, createInvitation, revokeInvitation } from '@/lib/settings/invitations'
import { createServiceClient } from '@/lib/db/server'
import type { OrgRole } from '@/types'

export const runtime = 'nodejs'

export async function GET() {
  const session = await requireSession()
  try {
    if (!session.org) {
      return NextResponse.json({ error: 'No organization context' }, { status: 400 })
    }
    if (!permissions.settings.manageUsers(session.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }
    const invitations = await getPendingInvitations(session.org.id)
    return NextResponse.json({ invitations })
  } catch {
    return NextResponse.json({ error: 'Failed to load invitations' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await requireSession()
  try {
    if (!session.org) {
      return NextResponse.json({ error: 'No organization context' }, { status: 400 })
    }
    if (!permissions.settings.manageUsers(session.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const email: string = body.email?.trim()
    const role: OrgRole = body.role

    if (!email || !role) {
      return NextResponse.json({ error: 'email and role are required' }, { status: 400 })
    }

    if (role === 'owner') {
      return NextResponse.json({ error: 'Cannot invite as owner' }, { status: 403 })
    }

    let invitation
    try {
      invitation = await createInvitation(session.org.id, email, role, session.id)
    } catch (err) {
      if (err instanceof Error && err.message === 'ALREADY_MEMBER') {
        return NextResponse.json({ error: 'Already a member' }, { status: 409 })
      }
      if (err instanceof Error && err.message === 'ALREADY_INVITED') {
        return NextResponse.json({ error: 'Invite already sent' }, { status: 409 })
      }
      throw err
    }

    try {
      const service = createServiceClient()
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      const { error: inviteError } = await service.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${appUrl}/invite/accept?token=${invitation.token}`,
      })
      if (inviteError) throw new Error(inviteError.message)
    } catch {
      await revokeInvitation(session.org.id, invitation.id)
      return NextResponse.json({ error: 'Failed to send invitation email' }, { status: 502 })
    }

    return NextResponse.json({ invitation }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 })
  }
}
