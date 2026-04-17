'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { useSearch } from '@/hooks/use-search'
import { SearchResultItem } from '@/components/search/search-result-item'
import type { SearchResult } from '@/lib/search'

export default function SearchPage() {
  // Initialize query from URL on mount (client-side only — avoids Suspense requirement)
  const [query, setQuery] = useState(() => {
    if (typeof window === 'undefined') return ''
    return new URLSearchParams(window.location.search).get('q') ?? ''
  })

  const router = useRouter()
  const { data, isLoading } = useSearch(query)

  // Keep URL in sync with query
  useEffect(() => {
    const params = query ? `?q=${encodeURIComponent(query)}` : ''
    router.replace(`/search${params}`, { scroll: false })
  }, [query, router])

  function handleNavigate(result: SearchResult) {
    router.push(result.url)
  }

  return (
    <div className="w-full px-3 sm:px-5 lg:px-8 py-4 sm:py-6 space-y-6">
      {/* Header */}
      <div>
        <h1
          className="text-2xl font-bold text-gray-900"
          style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif' }}
        >
          Search
        </h1>
        <p className="text-gray-500 mt-1 text-sm">Search documents, transactions, and vendors</p>
      </div>

      {/* Search input */}
      <div className="flex items-center gap-3 px-4 py-3 border border-gray-200 rounded-xl bg-white">
        <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Type to search…"
          autoFocus
          className="flex-1 text-sm text-gray-900 placeholder-gray-400 bg-transparent outline-none"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>

      {/* Prompt */}
      {query.trim().length < 2 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-sm text-gray-400">Type at least 2 characters to search</p>
        </div>
      )}

      {/* Loading skeleton */}
      {query.trim().length >= 2 && isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {query.trim().length >= 2 && !isLoading && data?.results.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-sm font-medium text-gray-700">
            No results for &ldquo;{query}&rdquo;
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Try different keywords or check your spelling
          </p>
        </div>
      )}

      {/* Results */}
      {!isLoading && data && data.results.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100">
            <p className="text-xs text-gray-400">
              {data.total} result{data.total !== 1 ? 's' : ''} for &ldquo;{data.query}&rdquo;
            </p>
          </div>
          {data.results.map(result => (
            <SearchResultItem
              key={result.id}
              result={result}
              isFocused={false}
              onClick={() => handleNavigate(result)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
