import { NextResponse, type NextRequest } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { permissions } from '@/lib/rbac/permissions'
import { LedgerRepository } from '@/lib/db/repositories/ledger-repository'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession()
    if (!permissions.ledger.view(session.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const date_from = searchParams.get('date_from') ?? undefined
    const date_to = searchParams.get('date_to') ?? undefined

    const balances = await LedgerRepository.getAccountBalances(session.org.id, date_from, date_to)
    return NextResponse.json({ balances })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to get balances' },
      { status: 500 }
    )
  }
}
