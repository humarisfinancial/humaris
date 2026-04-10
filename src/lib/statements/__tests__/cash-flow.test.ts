import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/repositories/ledger-repository', () => ({
  LedgerRepository: { list: vi.fn() },
}))

import { LedgerRepository } from '@/lib/db/repositories/ledger-repository'
import { computeCashFlow } from '../../../lib/statements/cash-flow'

const mockEntries = [
  {
    id: 'e1', account_id: 'a1', debit: 0, credit: 8000, category: 'consulting',
    entry_date: '2026-01-10', description: 'Revenue', source_doc_id: 'doc1',
    account: { id: 'a1', code: '4000', name: 'Service Revenue', type: 'revenue' },
  },
  {
    id: 'e2', account_id: 'a2', debit: 3000, credit: 0, category: 'payroll',
    entry_date: '2026-01-20', description: 'Payroll', source_doc_id: null,
    account: { id: 'a2', code: '6000', name: 'Payroll Expense', type: 'expense' },
  },
  {
    id: 'e3', account_id: 'a3', debit: 0, credit: 5000, category: 'loan',
    entry_date: '2026-01-05', description: 'Loan proceeds', source_doc_id: null,
    account: { id: 'a3', code: '2100', name: 'Loan Payable', type: 'liability' },
  },
]

describe('computeCashFlow', () => {
  beforeEach(() => {
    ;(LedgerRepository.list as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: mockEntries, total: 3, page: 1, per_page: 10000, has_more: false,
    })
  })

  it('computes operating, investing, financing and net cash flow', async () => {
    const result = await computeCashFlow('org-1', '2026-01-01', '2026-01-31')
    // Operating = revenue credit (8000) - expense debit (3000) net = 5000
    expect(result.totals.operating).toBe(5000)
    // Financing = liability credit (5000)
    expect(result.totals.financing).toBe(5000)
    // Net = operating + investing + financing
    expect(result.totals.net_cash_flow).toBe(
      result.totals.operating + result.totals.investing + result.totals.financing
    )
  })
})
