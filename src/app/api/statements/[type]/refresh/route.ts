import { NextResponse, type NextRequest } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { permissions } from '@/lib/rbac/permissions'
import { StatementRepository } from '@/lib/db/repositories/statement-repository'
import { computePnL } from '@/lib/statements/pnl'
import { computeBalanceSheet } from '@/lib/statements/balance-sheet'
import { computeCashFlow } from '@/lib/statements/cash-flow'
import type { StatementType } from '@/types'

export const runtime = 'nodejs'

const VALID_TYPES: StatementType[] = ['pnl', 'balance_sheet', 'cash_flow']

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const session = await requireSession()
    if (!permissions.statements.generate(session.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { type } = await params
    if (!VALID_TYPES.includes(type as StatementType)) {
      return NextResponse.json({ error: 'Invalid statement type' }, { status: 400 })
    }

    const body = await request.json()
    const { from, to } = body

    if (!from || !to) {
      return NextResponse.json({ error: 'from and to are required in request body' }, { status: 400 })
    }

    const statementType = type as StatementType
    const orgId = session.org.id

    const computeFn = statementType === 'pnl'
      ? computePnL
      : statementType === 'balance_sheet'
        ? computeBalanceSheet
        : computeCashFlow

    const data = await computeFn(orgId, from, to)
    const statement = await StatementRepository.saveCache(
      orgId, statementType, from, to, data, session.id
    )

    return NextResponse.json({ statement })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to refresh statement' },
      { status: 500 }
    )
  }
}
