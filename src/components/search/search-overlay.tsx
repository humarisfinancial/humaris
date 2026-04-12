'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { useSearch, groupResults } from '@/hooks/use-search'
import { SearchResultItem } from './search-result-item'
import type { SearchResult } from '@/lib/search'

export function SearchOverlay() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [focusedIndex, setFocusedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const pathname = usePathname()

  const { data, isLoading } = useSearch(query)
  const groups = data
    ? groupResults(data.results)
    : { documents: [], transactions: [], vendors: [] }

  // All navigable results in display order (5 per group max)
  const allResults: SearchResult[] = [
    ...groups.documents.slice(0, 5),
    ...groups.transactions.slice(0, 5),
    ...groups.vendors.slice(0, 5),
  ]

  // Close when route changes (user navigated away)
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Reset query and focus input when open state changes
  useEffect(() => {
    if (!open) {
      setQuery('')
      setFocusedIndex(0)
    } else {
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [open])

  // Global Cmd+K / Ctrl+K listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const navigate = useCallback(
    (result: SearchResult) => {
      router.push(result.url)
      setOpen(false)
    },
    [router]
  )

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setOpen(false)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIndex(i => Math.min(i + 1, allResults.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && allResults[focusedIndex]) {
      navigate(allResults[focusedIndex])
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-20"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-[560px] mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Input row */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100">
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value)
              setFocusedIndex(0)
            }}
            placeholder="Search documents, transactions, vendors…"
            className="flex-1 text-sm text-gray-900 placeholder-gray-400 bg-transparent outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-xs text-gray-400 border border-gray-200 rounded">
            Esc
          </kbd>
          <button
            onClick={() => setOpen(false)}
            className="sm:hidden text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results area */}
        <div className="max-h-96 overflow-y-auto py-2">
          {query.trim().length < 2 && (
            <p className="px-4 py-8 text-sm text-center text-gray-400">Type to search…</p>
          )}

          {query.trim().length >= 2 && isLoading && (
            <p className="px-4 py-8 text-sm text-center text-gray-400">Searching…</p>
          )}

          {query.trim().length >= 2 && !isLoading && allResults.length === 0 && (
            <p className="px-4 py-8 text-sm text-center text-gray-400">
              No results for &ldquo;{query}&rdquo;
            </p>
          )}

          {!isLoading && allResults.length > 0 && (
            <>
              {groups.documents.length > 0 && (
                <ResultSection
                  label="Documents"
                  results={groups.documents.slice(0, 5)}
                  total={groups.documents.length}
                  allResults={allResults}
                  focusedIndex={focusedIndex}
                  onNavigate={navigate}
                  query={query}
                />
              )}
              {groups.transactions.length > 0 && (
                <ResultSection
                  label="Transactions"
                  results={groups.transactions.slice(0, 5)}
                  total={groups.transactions.length}
                  allResults={allResults}
                  focusedIndex={focusedIndex}
                  onNavigate={navigate}
                  query={query}
                />
              )}
              {groups.vendors.length > 0 && (
                <ResultSection
                  label="Vendors"
                  results={groups.vendors.slice(0, 5)}
                  total={groups.vendors.length}
                  allResults={allResults}
                  focusedIndex={focusedIndex}
                  onNavigate={navigate}
                  query={query}
                />
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {allResults.length > 0 && (
          <div className="px-4 py-2.5 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-400">{data?.total ?? 0} results</span>
            <button
              onClick={() => {
                router.push(`/search?q=${encodeURIComponent(query)}`)
                setOpen(false)
              }}
              className="text-xs font-medium text-gray-500 hover:text-gray-700"
            >
              See all results →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ResultSection({
  label,
  results,
  total,
  allResults,
  focusedIndex,
  onNavigate,
  query,
}: {
  label: string
  results: SearchResult[]
  total: number
  allResults: SearchResult[]
  focusedIndex: number
  onNavigate: (r: SearchResult) => void
  query: string
}) {
  return (
    <div>
      <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-widest">
        {label}
      </p>
      {results.map(result => (
        <SearchResultItem
          key={result.id}
          result={result}
          isFocused={allResults.indexOf(result) === focusedIndex}
          onClick={() => onNavigate(result)}
        />
      ))}
      {total > 5 && (
        <button
          onClick={() => onNavigate({ ...results[0], url: `/search?q=${encodeURIComponent(query)}` })}
          className="block w-full px-4 py-1.5 text-xs text-left text-gray-400 hover:text-gray-600"
        >
          See all {total} {label.toLowerCase()} →
        </button>
      )}
    </div>
  )
}
