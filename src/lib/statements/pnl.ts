import { LedgerRepository } from '@/lib/db/repositories/ledger-repository'
import type { StatementData, StatementSection, LedgerEntry, ChartOfAccount } from '@/types'

interface AccountGroup {
  account: ChartOfAccount
  entries: LedgerEntry[]
}

function buildAccountSections(
  groups: AccountGroup[],
  balanceType: 'debit' | 'credit'
): StatementSection[] {
  return groups.map(({ account, entries }) => {
    const entryChildren: StatementSection[] = entries.map(e => ({
      label: e.description ?? `Entry ${e.id.slice(0, 8)}`,
      amount:
        balanceType === 'debit'
          ? Number(e.debit) - Number(e.credit)
          : Number(e.credit) - Number(e.debit),
      entry_id: e.id,
      source_doc_id: e.source_doc_id,
      entry_date: e.entry_date,
    }))
    return {
      label: account.name,
      code: account.code,
      amount: entryChildren.reduce((s, c) => s + c.amount, 0),
      children: entryChildren,
    }
  })
}

export async function computePnL(
  orgId: string,
  from: string,
  to: string
): Promise<StatementData> {
  const { items: entries } = await LedgerRepository.list(
    orgId,
    { date_from: from, date_to: to },
    { per_page: 10000 }
  )

  const byAccount = new Map<string, AccountGroup>()
  const uncategorized: LedgerEntry[] = []

  for (const entry of entries) {
    if (!entry.account) continue
    if (!byAccount.has(entry.account_id)) {
      byAccount.set(entry.account_id, { account: entry.account, entries: [] })
    }
    byAccount.get(entry.account_id)!.entries.push(entry)
    if (entry.category === null) uncategorized.push(entry)
  }

  const groups = [...byAccount.values()]
  const revenueGroups = groups.filter(g => g.account.type === 'revenue')
  const expenseGroups = groups.filter(g => g.account.type === 'expense')

  const revenueChildren = buildAccountSections(revenueGroups, 'credit')
  const expenseChildren = buildAccountSections(expenseGroups, 'debit')

  const totalRevenue = revenueChildren.reduce((s, c) => s + c.amount, 0)
  const totalExpenses = expenseChildren.reduce((s, c) => s + c.amount, 0)
  const netIncome = totalRevenue - totalExpenses

  return {
    sections: [
      { label: 'REVENUE', amount: totalRevenue, children: revenueChildren },
      { label: 'GROSS PROFIT', amount: totalRevenue },
      { label: 'OPERATING EXPENSES', amount: totalExpenses, children: expenseChildren },
      { label: 'NET INCOME', amount: netIncome },
    ],
    totals: { revenue: totalRevenue, expenses: totalExpenses, net_income: netIncome },
    metadata: {
      uncategorized_count: uncategorized.length,
      uncategorized_amount: uncategorized.reduce(
        (s, e) => s + Number(e.debit) - Number(e.credit),
        0
      ),
      uncategorized_entries: uncategorized.map(e => ({
        id: e.id,
        description: e.description,
        entry_date: e.entry_date,
        amount: Number(e.debit) || Number(e.credit),
        account_name: e.account?.name ?? 'Unknown',
      })),
    },
  }
}
