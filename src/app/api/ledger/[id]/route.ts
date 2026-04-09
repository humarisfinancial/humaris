import { NextResponse, type NextRequest } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { permissions } from '@/lib/rbac/permissions'
import { LedgerRepository } from '@/lib/db/repositories/ledger-repository'

export const runtime = 'nodejs'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession()
    if (!permissions.ledger.view(session.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { id } = await params
    const entry = await LedgerRepository.findById(id, session.org.id)
    if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({ entry })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to get ledger entry' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession()
    if (!permissions.ledger.edit(session.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { account_id, entry_date, description, debit, credit, category } = body

    if (debit !== undefined && credit !== undefined) {
      const d = Number(debit)
      const c = Number(credit)
      if ((d > 0 && c > 0) || (d === 0 && c === 0)) {
        return NextResponse.json(
          { error: 'Entry must have either a debit or a credit, not both or neither' },
          { status: 400 }
        )
      }
    }

    const updates: Record<string, unknown> = {}
    if (account_id !== undefined) updates.account_id = account_id
    if (entry_date !== undefined) updates.entry_date = entry_date
    if (description !== undefined) updates.description = description
    if (debit !== undefined) updates.debit = Number(debit)
    if (credit !== undefined) updates.credit = Number(credit)
    if (category !== undefined) updates.category = category

    const entry = await LedgerRepository.update(id, session.org.id, updates)
    return NextResponse.json({ entry })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update ledger entry' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession()
    if (!permissions.ledger.delete(session.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { id } = await params
    await LedgerRepository.delete(id, session.org.id)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete ledger entry' },
      { status: 500 }
    )
  }
}
