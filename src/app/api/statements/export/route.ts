import { NextResponse, type NextRequest } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { permissions } from '@/lib/rbac/permissions'
import { StatementRepository } from '@/lib/db/repositories/statement-repository'
import { computePnL } from '@/lib/statements/pnl'
import { computeBalanceSheet } from '@/lib/statements/balance-sheet'
import { computeCashFlow } from '@/lib/statements/cash-flow'
import { exportStatement } from '@/lib/statements/export'
import type { StatementType } from '@/types'

export const runtime = 'nodejs'

const VALID_TYPES: StatementType[] = ['pnl', 'balance_sheet', 'cash_flow']
const VALID_FORMATS = ['pdf', 'xlsx', 'csv'] as const
type ExportFormat = typeof VALID_FORMATS[number]

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession()
    if (!permissions.statements.export(session.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const format = searchParams.get('format')

    if (!type || !VALID_TYPES.includes(type as StatementType)) {
      return NextResponse.json({ error: 'Invalid statement type' }, { status: 400 })
    }
    if (!from || !to) {
      return NextResponse.json({ error: 'from and to are required' }, { status: 400 })
    }
    if (!format || !VALID_FORMATS.includes(format as ExportFormat)) {
      return NextResponse.json({ error: 'format must be pdf, xlsx, or csv' }, { status: 400 })
    }

    const statementType = type as StatementType
    const orgId = session.org.id

    // Use cache if available, otherwise compute
    let data = (await StatementRepository.getCached(orgId, statementType, from, to))?.data

    if (!data) {
      const computeFn = statementType === 'pnl'
        ? computePnL
        : statementType === 'balance_sheet'
          ? computeBalanceSheet
          : computeCashFlow
      data = await computeFn(orgId, from, to)
    }

    const { buffer, contentType, filename } = await exportStatement(
      data,
      statementType,
      format as ExportFormat
    )

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Export failed' },
      { status: 500 }
    )
  }
}
