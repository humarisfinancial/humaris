import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/server', () => ({
  createServerSupabaseClient: vi.fn(),
}))

import { createServerSupabaseClient } from '@/lib/db/server'
import { postgresSearchProvider } from '../index'

/** Builds a mock Supabase client where each table returns different data. */
function makeSupabaseMock({
  docs = [] as unknown[],
  entries = [] as unknown[],
  vendors = [] as unknown[],
} = {}) {
  function makeChain(data: unknown[]) {
    const chain: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'textSearch', 'ilike', 'order']) {
      chain[m] = vi.fn().mockReturnValue(chain)
    }
    chain.limit = vi.fn().mockResolvedValue({ data, error: null })
    return chain
  }
  return {
    from: vi.fn((table: string) => {
      if (table === 'documents') return makeChain(docs)
      if (table === 'ledger_entries') return makeChain(entries)
      return makeChain(vendors)
    }),
  }
}

describe('postgresSearchProvider.search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns document results with correct shape', async () => {
    ;(createServerSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeSupabaseMock({
        docs: [{
          id: 'd1',
          renamed_name: 'Invoice ABC',
          original_name: null,
          doc_type: 'Invoice',
          folder: 'Invoices',
        }],
      })
    )
    const results = await postgresSearchProvider.search('ABC', 'org1')
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      id: 'd1',
      type: 'document',
      title: 'Invoice ABC',
      subtitle: 'Invoice · Invoices',
      url: '/documents/d1',
    })
  })

  it('falls back to original_name when renamed_name is null', async () => {
    ;(createServerSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeSupabaseMock({
        docs: [{ id: 'd1', renamed_name: null, original_name: 'scan001.pdf', doc_type: null, folder: null }],
      })
    )
    const results = await postgresSearchProvider.search('scan', 'org1')
    expect(results[0].title).toBe('scan001.pdf')
  })

  it('returns transaction results with correct shape', async () => {
    ;(createServerSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeSupabaseMock({
        entries: [{ id: 'e1', description: 'Office supplies', entry_date: '2026-01-15', debit: 500, credit: 0 }],
      })
    )
    const results = await postgresSearchProvider.search('office', 'org1')
    const txn = results.find(r => r.type === 'transaction')!
    expect(txn).toMatchObject({
      id: 'e1',
      type: 'transaction',
      title: 'Office supplies',
      subtitle: '2026-01-15 · Debit $500',
      url: '/ledger?highlight=e1',
    })
  })

  it('deduplicates vendor results by name', async () => {
    ;(createServerSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeSupabaseMock({
        vendors: [
          { id: 'v1', vendor_name: 'ACME Corp', transaction_date: '2026-01-10' },
          { id: 'v2', vendor_name: 'ACME Corp', transaction_date: '2026-01-05' },
        ],
      })
    )
    const results = await postgresSearchProvider.search('ACME', 'org1')
    const vendors = results.filter(r => r.type === 'vendor')
    expect(vendors).toHaveLength(1)
    expect(vendors[0].title).toBe('ACME Corp')
  })

  it('returns empty array when no results found', async () => {
    ;(createServerSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeSupabaseMock()
    )
    const results = await postgresSearchProvider.search('nonexistent', 'org1')
    expect(results).toEqual([])
  })
})
