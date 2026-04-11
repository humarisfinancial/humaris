import { NextResponse, type NextRequest } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { permissions } from '@/lib/rbac/permissions'
import { LedgerRepository } from '@/lib/db/repositories/ledger-repository'
import { computeKPIs, getMomPrior, getYoyPrior } from '@/lib/kpi/compute'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession()

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    if (!from || !to) {
      return NextResponse.json({ error: 'from and to are required' }, { status: 400 })
    }

    if (!permissions.dashboard.view(session.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const orgId = session.org.id
    const momPeriod = getMomPrior(from, to)
    const yoyPeriod = getYoyPrior(from, to)

    const [currentBalances, momBalances, yoyBalances] = await Promise.all([
      LedgerRepository.getAccountBalances(orgId, from, to),
      LedgerRepository.getAccountBalances(orgId, momPeriod.from, momPeriod.to),
      LedgerRepository.getAccountBalances(orgId, yoyPeriod.from, yoyPeriod.to),
    ])

    const current = computeKPIs(currentBalances)
    const mom = computeKPIs(momBalances)
    const yoy = computeKPIs(yoyBalances)

    const revenueGrowthRate = mom.revenue > 0
      ? ((current.revenue - mom.revenue) / mom.revenue) * 100
      : null

    const expenseBreakdown = currentBalances
      .filter(b => b.account_type === 'expense' && b.total_debit > b.total_credit)
      .map(b => ({ name: b.account_name, value: b.total_debit - b.total_credit }))
      .sort((a, b) => b.value - a.value)

    const fromLabel = new Date(from + 'T00:00:00Z').toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', timeZone: 'UTC',
    })
    const toLabel = new Date(to + 'T00:00:00Z').toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
    })

    return NextResponse.json({
      current,
      mom,
      yoy,
      revenueGrowthRate,
      expenseBreakdown,
      periodLabel: `${fromLabel} – ${toLabel}`,
      generatedAt: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load KPIs' },
      { status: 500 }
    )
  }
}
