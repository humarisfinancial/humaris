import { describe, it, expect } from 'vitest'
import { computeKPIs, getMomPrior, getYoyPrior } from '../compute'
import type { AccountBalance } from '@/types'

const FIXTURES: AccountBalance[] = [
  { account_id: 'a1', account_code: '4000', account_name: 'Service Revenue', account_type: 'revenue', total_debit: 0, total_credit: 10000, balance: -10000 },
  { account_id: 'a2', account_code: '5000', account_name: 'Cost of Goods', account_type: 'expense', total_debit: 3000, total_credit: 0, balance: 3000 },
  { account_id: 'a3', account_code: '6000', account_name: 'Rent', account_type: 'expense', total_debit: 2000, total_credit: 0, balance: 2000 },
  { account_id: 'a4', account_code: '1000', account_name: 'Cash', account_type: 'asset', total_debit: 5000, total_credit: 0, balance: 5000 },
  { account_id: 'a5', account_code: '2000', account_name: 'Loan Payable', account_type: 'liability', total_debit: 0, total_credit: 2000, balance: -2000 },
]

describe('computeKPIs', () => {
  it('computes revenue from credit-side revenue accounts', () => {
    expect(computeKPIs(FIXTURES).revenue).toBe(10000)
  })

  it('separates COGS (5xxx codes) for gross profit', () => {
    expect(computeKPIs(FIXTURES).grossProfit).toBe(7000)
  })

  it('computes net income as revenue minus all expenses', () => {
    expect(computeKPIs(FIXTURES).netIncome).toBe(5000)
  })

  it('computes net cash flow from operating, investing, and financing activities', () => {
    // operating (5000) + investing (-5000) + financing (2000) = 2000
    expect(computeKPIs(FIXTURES).netCashFlow).toBe(2000)
  })

  it('computes total expenses from all expense account debits', () => {
    expect(computeKPIs(FIXTURES).totalExpenses).toBe(5000)
  })

  it('computes gross margin as grossProfit / revenue × 100', () => {
    expect(computeKPIs(FIXTURES).grossMargin).toBeCloseTo(70.0)
  })

  it('computes net margin as netIncome / revenue × 100', () => {
    expect(computeKPIs(FIXTURES).netMargin).toBeCloseTo(50.0)
  })

  it('returns null margins when revenue is zero', () => {
    const result = computeKPIs([])
    expect(result.grossMargin).toBeNull()
    expect(result.netMargin).toBeNull()
  })

  it('returns all zeros on empty balances', () => {
    const result = computeKPIs([])
    expect(result.revenue).toBe(0)
    expect(result.grossProfit).toBe(0)
    expect(result.netIncome).toBe(0)
    expect(result.totalExpenses).toBe(0)
    expect(result.netCashFlow).toBe(0)
  })
})

describe('getMomPrior', () => {
  it('shifts a 10-day period back by 10 days', () => {
    expect(getMomPrior('2026-04-01', '2026-04-10')).toEqual({
      from: '2026-03-22',
      to: '2026-03-31',
    })
  })

  it('handles month boundary: Feb shifts to Jan', () => {
    expect(getMomPrior('2026-02-01', '2026-02-28')).toEqual({
      from: '2026-01-04',
      to: '2026-01-31',
    })
  })
})

describe('getYoyPrior', () => {
  it('shifts a date range back by one year', () => {
    expect(getYoyPrior('2026-04-01', '2026-04-10')).toEqual({
      from: '2025-04-01',
      to: '2025-04-10',
    })
  })

  it('shifts a year-start range back by one year', () => {
    expect(getYoyPrior('2026-01-01', '2026-01-31')).toEqual({
      from: '2025-01-01',
      to: '2025-01-31',
    })
  })
})
