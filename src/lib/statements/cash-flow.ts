import { LedgerRepository } from '@/lib/db/repositories/ledger-repository'
import type { StatementData, StatementSection, LedgerEntry, ChartOfAccount } from '@/types'

interface AccountGroup {
  account: ChartOfAccount
  entries: LedgerEntry[]
}

function buildSection(label: string, groups: AccountGroup[]): StatementSection {
  const children: StatementSection[] = groups.map(({ account, entries }) => {
    const entryChildren: StatementSection[] = entries.map(e => ({
      label: e.description ?? `Entry ${e.id.slice(0, 8)}`,
      amount: Number(e.credit) - Number(e.debit),
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
  return { label, amount: children.reduce((s, c) => s + c.amount, 0), children }
}

export async function computeCashFlow(
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

  const operatingGroups = groups.filter(g => g.account.type === 'revenue' || g.account.type === 'expense')
  const investingGroups = groups.filter(g => g.account.type === 'asset')
  const financingGroups = groups.filter(g => g.account.type === 'liability' || g.account.type === 'equity')

  const operatingSection = buildSection('OPERATING ACTIVITIES', operatingGroups)
  const investingSection = buildSection('INVESTING ACTIVITIES', investingGroups)
  const financingSection = buildSection('FINANCING ACTIVITIES', financingGroups)

  const netCashFlow = operatingSection.amount + investingSection.amount + financingSection.amount

  return {
    sections: [
      operatingSection,
      investingSection,
      financingSection,
      { label: 'NET CASH FLOW', amount: netCashFlow },
    ],
    totals: {
      operating: operatingSection.amount,
      investing: investingSection.amount,
      financing: financingSection.amount,
      net_cash_flow: netCashFlow,
    },
    metadata: {
      uncategorized_count: uncategorized.length,
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
