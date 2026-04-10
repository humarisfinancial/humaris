import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/db/repositories/ledger-repository', () => ({
  LedgerRepository: {
    list: vi.fn(),
  },
}))

import { LedgerRepository } from '@/lib/db/repositories/ledger-repository'
import { computePnL } from '../../../lib/statements/pnl'

const mockEntries = [
  {
    id: 'e1', account_id: 'a1', debit: 0, credit: 5000, category: 'consulting',
    entry_date: '2026-01-15', description: 'Invoice Acme', source_doc_id: 'doc1',
    account: { id: 'a1', code: '4000', name: 'Service Revenue', type: 'revenue' },
  },
  {
    id: 'e2', account_id: 'a2', debit: 2000, credit: 0, category: 'software',
    entry_date: '2026-01-20', description: 'AWS bill', source_doc_id: null,
    account: { id: 'a2', code: '6000', name: 'Software Expenses', type: 'expense' },
  },
  {
    id: 'e3', account_id: 'a3', debit: 500, credit: 0, category: null,
    entry_date: '2026-01-25', description: 'Unknown charge', source_doc_id: null,
    account: { id: 'a3', code: '6999', name: 'Misc', type: 'expense' },
  },
]

describe('computePnL', () => {
  it('produces correct revenue, expenses, and net income', async () => {
    ;(LedgerRepository.list as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: mockEntries,
      total: 3,
      page: 1,
      per_page: 10000,
      has_more: false,
    })

    const result = await computePnL('org-1', '2026-01-01', '2026-01-31')

    expect(result.totals.revenue).toBe(5000)
    expect(result.totals.expenses).toBe(2500)
    expect(result.totals.net_income).toBe(2500)
  })

  it('puts entries with null category in uncategorized metadata', async () => {
    ;(LedgerRepository.list as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: mockEntries,
      total: 3,
      page: 1,
      per_page: 10000,
      has_more: false,
    })

    const result = await computePnL('org-1', '2026-01-01', '2026-01-31')
    expect(result.metadata.uncategorized_count).toBe(1)
  })

  it('returns zero totals when no entries', async () => {
    ;(LedgerRepository.list as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: [], total: 0, page: 1, per_page: 10000, has_more: false,
    })

    const result = await computePnL('org-1', '2026-01-01', '2026-01-31')
    expect(result.totals.net_income).toBe(0)
  })
})
