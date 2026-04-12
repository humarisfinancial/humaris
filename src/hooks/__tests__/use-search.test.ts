import { describe, it, expect } from 'vitest'
import { groupResults } from '../use-search'
import type { SearchResult } from '@/lib/search'

function makeResult(type: SearchResult['type'], id: string): SearchResult {
  return { id, type, title: `${type} ${id}`, subtitle: '', url: `/${id}` }
}

describe('groupResults', () => {
  it('groups results by type correctly', () => {
    const results = [
      makeResult('document', '1'),
      makeResult('transaction', '2'),
      makeResult('vendor', '3'),
      makeResult('document', '4'),
    ]
    const grouped = groupResults(results)
    expect(grouped.documents).toHaveLength(2)
    expect(grouped.transactions).toHaveLength(1)
    expect(grouped.vendors).toHaveLength(1)
  })

  it('returns empty arrays for types with no results', () => {
    const grouped = groupResults([makeResult('document', '1')])
    expect(grouped.transactions).toHaveLength(0)
    expect(grouped.vendors).toHaveLength(0)
  })

  it('returns all empty arrays for empty input', () => {
    const grouped = groupResults([])
    expect(grouped.documents).toHaveLength(0)
    expect(grouped.transactions).toHaveLength(0)
    expect(grouped.vendors).toHaveLength(0)
  })
})
