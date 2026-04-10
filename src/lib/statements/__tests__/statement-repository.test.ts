import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/server', () => ({
  createServerSupabaseClient: vi.fn(),
}))

import { createServerSupabaseClient } from '@/lib/db/server'
import { StatementRepository } from '../../../lib/db/repositories/statement-repository'
import type { StatementData } from '@/types'

const MOCK_ORG_ID = 'org-123'
const MOCK_DATA: StatementData = {
  sections: [{ label: 'REVENUE', amount: 1000 }],
  totals: { revenue: 1000, net_income: 1000 },
  metadata: {},
}

describe('StatementRepository', () => {
  let mockFrom: ReturnType<typeof vi.fn>
  let mockChain: Record<string, ReturnType<typeof vi.fn>>

  beforeEach(() => {
    mockChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      single: vi.fn(),
    }
    mockFrom = vi.fn().mockReturnValue(mockChain)
    ;(createServerSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue({ from: mockFrom })
  })

  it('getCached returns null on cache miss', async () => {
    mockChain.single.mockResolvedValue({ data: null, error: null })
    const result = await StatementRepository.getCached(MOCK_ORG_ID, 'pnl', '2026-01-01', '2026-03-31')
    expect(result).toBeNull()
  })

  it('getCached returns data on cache hit', async () => {
    mockChain.single.mockResolvedValue({
      data: { id: '1', data: MOCK_DATA, generated_at: '2026-01-01T00:00:00Z' },
      error: null,
    })
    const result = await StatementRepository.getCached(MOCK_ORG_ID, 'pnl', '2026-01-01', '2026-03-31')
    expect(result?.data).toEqual(MOCK_DATA)
  })

  it('clearCacheForOrg calls delete with org_id filter', async () => {
    mockChain.eq.mockReturnThis()
    await StatementRepository.clearCacheForOrg(MOCK_ORG_ID)
    expect(mockFrom).toHaveBeenCalledWith('financial_statements')
    expect(mockChain.delete).toHaveBeenCalled()
    expect(mockChain.eq).toHaveBeenCalledWith('org_id', MOCK_ORG_ID)
  })

  it('saveCache inserts and returns the saved statement', async () => {
    // delete returns no error
    mockChain.eq.mockReturnThis()
    // insert chain needs select and single
    const insertChain = {
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'stmt-1', org_id: MOCK_ORG_ID, type: 'pnl', period_start: '2026-01-01', period_end: '2026-03-31', data: MOCK_DATA, generated_at: '2026-04-01T00:00:00Z' },
        error: null,
      }),
    }
    mockChain.insert = vi.fn().mockReturnValue(insertChain)

    const result = await StatementRepository.saveCache(
      MOCK_ORG_ID, 'pnl', '2026-01-01', '2026-03-31', MOCK_DATA, 'user-1'
    )
    expect(result.id).toBe('stmt-1')
    expect(result.data).toEqual(MOCK_DATA)
  })
})
