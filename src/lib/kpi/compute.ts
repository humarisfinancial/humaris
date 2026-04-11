import type { AccountBalance, KPISnapshot } from '@/types'

export function computeKPIs(balances: AccountBalance[]): KPISnapshot {
  const revenueAccounts = balances.filter(b => b.account_type === 'revenue')
  const expenseAccounts = balances.filter(b => b.account_type === 'expense')
  const assetAccounts = balances.filter(b => b.account_type === 'asset')
  const liabilityEquityAccounts = balances.filter(
    b => b.account_type === 'liability' || b.account_type === 'equity'
  )

  // Revenue: credit is the normal balance side
  const revenue = revenueAccounts.reduce((s, b) => s + b.total_credit - b.total_debit, 0)

  // COGS: expense accounts with account code starting with '5' (5000–5999)
  const cogsAmount = expenseAccounts
    .filter(b => b.account_code.startsWith('5'))
    .reduce((s, b) => s + b.total_debit - b.total_credit, 0)

  const grossProfit = revenue - cogsAmount

  // Total expenses: debit is the normal balance side
  const totalExpenses = expenseAccounts.reduce((s, b) => s + b.total_debit - b.total_credit, 0)

  const netIncome = revenue - totalExpenses

  // Cash flow: credit - debit for each group
  const operatingCF = [...revenueAccounts, ...expenseAccounts]
    .reduce((s, b) => s + b.total_credit - b.total_debit, 0)
  const investingCF = assetAccounts
    .reduce((s, b) => s + b.total_credit - b.total_debit, 0)
  const financingCF = liabilityEquityAccounts
    .reduce((s, b) => s + b.total_credit - b.total_debit, 0)
  const netCashFlow = operatingCF + investingCF + financingCF

  return {
    revenue,
    grossProfit,
    netIncome,
    totalExpenses,
    netCashFlow,
    grossMargin: revenue > 0 ? (grossProfit / revenue) * 100 : null,
    netMargin: revenue > 0 ? (netIncome / revenue) * 100 : null,
  }
}

/** Shifts from–to back by the same number of days (window immediately before). */
export function getMomPrior(from: string, to: string): { from: string; to: string } {
  const fromDate = new Date(from + 'T00:00:00Z')
  const toDate = new Date(to + 'T00:00:00Z')
  const days = Math.round((toDate.getTime() - fromDate.getTime()) / 86400000) + 1

  const newTo = new Date(fromDate)
  newTo.setUTCDate(newTo.getUTCDate() - 1)

  const newFrom = new Date(newTo)
  newFrom.setUTCDate(newFrom.getUTCDate() - days + 1)

  return {
    from: newFrom.toISOString().split('T')[0],
    to: newTo.toISOString().split('T')[0],
  }
}

/** Shifts from–to back by exactly one year. */
export function getYoyPrior(from: string, to: string): { from: string; to: string } {
  const fromDate = new Date(from + 'T00:00:00Z')
  const toDate = new Date(to + 'T00:00:00Z')
  fromDate.setUTCFullYear(fromDate.getUTCFullYear() - 1)
  toDate.setUTCFullYear(toDate.getUTCFullYear() - 1)
  return {
    from: fromDate.toISOString().split('T')[0],
    to: toDate.toISOString().split('T')[0],
  }
}
