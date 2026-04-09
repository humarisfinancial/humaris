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
    const page = parseInt(searchParams.get('page') ?? '1', 10)
    const per_page = parseInt(searchParams.get('per_page') ?? '50', 10)
    const account_id = searchParams.get('account_id') ?? undefined
    const date_from = searchParams.get('date_from') ?? undefined
    const date_to = searchParams.get('date_to') ?? undefined
    const is_manual = searchParams.has('is_manual')
      ? searchParams.get('is_manual') === 'true'
      : undefined

    const result = await LedgerRepository.list(
      session.org.id,
      { account_id, date_from, date_to, is_manual },
      { page, per_page }
    )

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to list ledger entries' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession()
    if (!permissions.ledger.create(session.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { account_id, entry_date, description, debit, credit, category } = body

    if (!account_id || !entry_date) {
      return NextResponse.json({ error: 'account_id and entry_date are required' }, { status: 400 })
    }

    const debitAmount = Number(debit ?? 0)
    const creditAmount = Number(credit ?? 0)

    if ((debitAmount > 0 && creditAmount > 0) || (debitAmount === 0 && creditAmount === 0)) {
      return NextResponse.json(
        { error: 'Entry must have either a debit or a credit, not both or neither' },
        { status: 400 }
      )
    }

    const entry = await LedgerRepository.create({
      org_id: session.org.id,
      account_id,
      entry_date,
      description: description ?? null,
      debit: debitAmount,
      credit: creditAmount,
      category: category ?? null,
      is_manual: true,
      created_by: session.id,
    })

    return NextResponse.json({ entry }, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create ledger entry' },
      { status: 500 }
    )
  }
}
