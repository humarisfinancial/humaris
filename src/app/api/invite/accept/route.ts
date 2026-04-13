import { NextResponse, type NextRequest } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { acceptInvitation } from '@/lib/settings/invitations'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const session = await requireSession()
  try {
    const body = await request.json()
    const token: string = body.token?.trim()

    if (!token) {
      return NextResponse.json({ error: 'TOKEN_INVALID' }, { status: 400 })
    }

    const result = await acceptInvitation(token, session.id, session.email ?? '')
    return NextResponse.json({ orgId: result.orgId })
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'TOKEN_EXPIRED') {
        return NextResponse.json({ error: 'TOKEN_EXPIRED' }, { status: 400 })
      }
      if (err.message === 'TOKEN_USED') {
        return NextResponse.json({ error: 'TOKEN_USED' }, { status: 400 })
      }
      if (err.message === 'TOKEN_INVALID') {
        return NextResponse.json({ error: 'TOKEN_INVALID' }, { status: 400 })
      }
    }
    return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 500 })
  }
}
