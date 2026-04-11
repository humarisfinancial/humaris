import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { permissions } from '@/lib/rbac/permissions'
import { LedgerRepository } from '@/lib/db/repositories/ledger-repository'
import { computeKPIs } from '@/lib/kpi/compute'

export const runtime = 'nodejs'

function getTrailing12Months(): { month: string; from: string; to: string }[] {
  const now = new Date()
  const result = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    const y = d.getUTCFullYear()
    const m = d.getUTCMonth()
    const from = new Date(Date.UTC(y, m, 1)).toISOString().split('T')[0]
    const to =
      i === 0
        ? now.toISOString().split('T')[0]
        : new Date(Date.UTC(y, m + 1, 0)).toISOString().split('T')[0]
    result.push({
      month: `${y}-${String(m + 1).padStart(2, '0')}`,
      from,
      to,
    })
  }
  return result
}

export async function GET() {
  const session = await requireSession()

  try {
    if (!permissions.dashboard.view(session.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    if (!session.org) {
      return NextResponse.json({ error: 'No organization context' }, { status: 400 })
    }

    const orgId = session.org.id
    const months = getTrailing12Months()

    const balancesPerMonth = await Promise.all(
      months.map(m => LedgerRepository.getAccountBalances(orgId, m.from, m.to))
    )

    const result = months.map((m, i) => {
      const kpis = computeKPIs(balancesPerMonth[i])
      return { month: m.month, revenue: kpis.revenue, netIncome: kpis.netIncome }
    })

    return NextResponse.json({ months: result })
  } catch (err) {
    void err
    return NextResponse.json(
      { error: 'Failed to load trend data' },
      { status: 500 }
    )
  }
}
