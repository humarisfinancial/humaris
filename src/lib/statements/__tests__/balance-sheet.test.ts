import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/repositories/ledger-repository', () => ({
  LedgerRepository: { list: vi.fn() },
}))

import { LedgerRepository } from '@/lib/db/repositories/ledger-repository'
import { computeBalanceSheet } from '../../../lib/statements/balance-sheet'

const mockEntries = [
  {
    id: 'e1', account_id: 'a1', debit: 10000, credit: 0, category: 'cash',
    entry_date: '2026-01-10', description: 'Cash deposit', source_doc_id: null,
    account: { id: 'a1', code: '1000', name: 'Cash', type: 'asset' },
  },
  {
    id: 'e2', account_id: 'a2', debit: 0, credit: 4000, category: 'accounts_payable',
    entry_date: '2026-01-15', description: 'Vendor invoice', source_doc_id: 'doc2',
    account: { id: 'a2', code: '2000', name: 'Accounts Payable', type: 'liability' },
  },
  {
    id: 'e3', account_id: 'a3', debit: 0, credit: 6000, category: 'equity',
    entry_date: '2026-01-01', description: 'Owner capital', source_doc_id: null,
    account: { id: 'a3', code: '3000', name: 'Owner Equity', type: 'equity' },
  },
]

describe('computeBalanceSheet', () => {
  beforeEach(() => {
    ;(LedgerRepository.list as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: mockEntries, total: 3, page: 1, per_page: 10000, has_more: false,
    })
  })

  it('computes correct asset, liability and equity totals', async () => {
    const result = await computeBalanceSheet('org-1', '2026-01-01', '2026-01-31')
    expect(result.totals.assets).toBe(10000)
    expect(result.totals.liabilities).toBe(4000)
    expect(result.totals.equity).toBe(6000)
  })

  it('is_balanced is true when assets = liabilities + equity', async () => {
    const result = await computeBalanceSheet('org-1', '2026-01-01', '2026-01-31')
    expect(result.metadata.is_balanced).toBe(true)
  })
})
