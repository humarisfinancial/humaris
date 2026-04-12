'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { SearchResult } from '@/lib/search'

export interface SearchResponse {
  results: SearchResult[]
  query: string
  total: number
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export function useSearch(query: string) {
  const debouncedQuery = useDebounce(query.trim(), 200)

  return useQuery<SearchResponse>({
    queryKey: ['search', debouncedQuery],
    queryFn: async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`)
      if (!res.ok) throw new Error((await res.json()).error ?? 'Search failed')
      return res.json()
    },
    enabled: debouncedQuery.length >= 2,
  })
}

export function groupResults(results: SearchResult[]): {
  documents: SearchResult[]
  transactions: SearchResult[]
  vendors: SearchResult[]
} {
  return {
    documents: results.filter(r => r.type === 'document'),
    transactions: results.filter(r => r.type === 'transaction'),
    vendors: results.filter(r => r.type === 'vendor'),
  }
}
