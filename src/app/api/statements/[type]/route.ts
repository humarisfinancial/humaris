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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const session = await requireSession()
    if (!permissions.statements.view(session.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { type } = await params
    if (!VALID_TYPES.includes(type as StatementType)) {
      return NextResponse.json({ error: 'Invalid statement type' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    if (!from || !to) {
      return NextResponse.json({ error: 'from and to query params are required' }, { status: 400 })
    }

    const statementType = type as StatementType
    const orgId = session.org.id

    // Check cache
    const cached = await StatementRepository.getCached(orgId, statementType, from, to)
    if (cached) {
      return NextResponse.json({ statement: cached, cached: true })
    }

    // Compute
    const computeFn = statementType === 'pnl'
      ? computePnL
      : statementType === 'balance_sheet'
        ? computeBalanceSheet
        : computeCashFlow

    const data = await computeFn(orgId, from, to)

    const statement = await StatementRepository.saveCache(
      orgId, statementType, from, to, data, session.id
    )

    return NextResponse.json({ statement, cached: false })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate statement' },
      { status: 500 }
    )
  }
}
