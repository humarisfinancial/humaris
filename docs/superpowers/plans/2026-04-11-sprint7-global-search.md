# Global Platform Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder `/search` page and upgrade the existing `ilike` search library to a full-text Postgres search with a Cmd+K floating overlay accessible from any page.

**Architecture:** A DB migration adds `GENERATED ALWAYS` tsvector columns to `documents` and `ledger_entries` (auto-maintained by Postgres, no indexing pipeline). The upgraded `PostgresSearchProvider` queries these via `websearch_to_tsquery`. A `GET /api/search?q=` route wraps the provider behind auth. A `<SearchOverlay>` mounts in the app shell, listens for Cmd+K/Ctrl+K globally, and renders grouped results. The `/search` page is a full-page version using the same hook.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (Postgres FTS + `websearch_to_tsquery`), TanStack Query v5, Vitest, lucide-react, Tailwind CSS v4

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `supabase/migrations/006_search_vectors.sql` | Add tsvector columns + GIN indexes |
| Modify | `src/lib/search/index.ts` | Replace ilike with FTS; add SearchProvider interface |
| Create | `src/lib/search/__tests__/search.test.ts` | Unit tests for postgresSearchProvider |
| Create | `src/app/api/search/route.ts` | GET /api/search?q= |
| Create | `src/app/api/search/__tests__/route.test.ts` | API route tests |
| Create | `src/hooks/use-search.ts` | useSearch hook + useDebounce + groupResults |
| Create | `src/hooks/__tests__/use-search.test.ts` | Unit tests for groupResults |
| Create | `src/components/search/search-result-item.tsx` | Single result row component |
| Create | `src/components/search/search-overlay.tsx` | Cmd+K floating overlay |
| Modify | `src/components/layout/app-shell.tsx` | Mount SearchOverlay; add ⌘K hint to Search nav item |
| Modify | `src/app/(app)/search/page.tsx` | Replace placeholder with full-page search |

---

## Codebase Context

**`createServerSupabaseClient()`** — async, returns a Supabase JS client. Import from `@/lib/db/server`. Call with `await`.

**`requireSession()`** — call **before** the try/catch block. It uses Next.js `redirect()` which throws a special error that must not be caught. Pattern used in all KPI routes:
```ts
const session = await requireSession()  // outside try
try {
  // handler body
} catch {
  return NextResponse.json({ error: '...' }, { status: 500 })
}
```

**`session.org`** — can be `null` for super-admins. Always guard with `if (!session.org)` before accessing `session.org.id`.

**Supabase FTS method:**
```ts
supabase
  .from('documents')
  .select('...')
  .eq('org_id', orgId)
  .textSearch('search_vector', query, { type: 'websearch', config: 'english' })
  .order('created_at', { ascending: false })
  .limit(20)
```

**`app-shell.tsx` NAV_ITEMS** — currently a plain `{ href, label, icon }[]`. Sprint 7 adds an optional `hint?: string` field for the `⌘K` badge.

**Vitest test runner:** `cd /Users/faris/Documents/Humaris && npx vitest run <path> --reporter=verbose`

---

## Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/006_search_vectors.sql`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/006_search_vectors.sql`:

```sql
-- Sprint 7: Add generated tsvector columns for full-text search.
-- These are auto-maintained by Postgres on every insert/update.
-- No separate indexing pipeline required.

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(renamed_name, '') || ' ' ||
      coalesce(original_name, '') || ' ' ||
      coalesce(doc_type, '') || ' ' ||
      coalesce(folder, ''))
  ) STORED;

ALTER TABLE ledger_entries
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(description, '') || ' ' ||
      coalesce(category, ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_documents_search_vector
  ON documents USING gin(search_vector);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_search_vector
  ON ledger_entries USING gin(search_vector);
```

- [ ] **Step 2: Apply the migration**

Apply via your Supabase workflow (Supabase CLI: `npx supabase db push`, or paste into the Supabase SQL editor).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/006_search_vectors.sql
git commit -m "feat: add FTS tsvector columns to documents and ledger_entries"
```

---

## Task 2: Search library upgrade + tests

**Files:**
- Modify: `src/lib/search/index.ts`
- Create: `src/lib/search/__tests__/search.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/search/__tests__/search.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/faris/Documents/Humaris && npx vitest run src/lib/search/__tests__/search.test.ts --reporter=verbose 2>&1
```

Expected: FAIL — `Cannot find module '../index'` or import errors.

- [ ] **Step 3: Replace src/lib/search/index.ts**

Replace the entire file content:

```ts
import { createServerSupabaseClient } from '@/lib/db/server'

export interface SearchResult {
  id: string
  type: 'document' | 'transaction' | 'vendor'
  title: string
  subtitle: string
  url: string
}

export interface SearchProvider {
  search(query: string, orgId: string, limit?: number): Promise<SearchResult[]>
}

/** Stub interface for future external connectors (Gmail, Slack). No MVP implementation. */
export interface ExternalSearchProvider extends SearchProvider {
  readonly providerName: string
}

export const postgresSearchProvider: SearchProvider = {
  async search(query: string, orgId: string, limit = 20): Promise<SearchResult[]> {
    const supabase = await createServerSupabaseClient()

    const [docsResult, entriesResult, vendorsResult] = await Promise.all([
      supabase
        .from('documents')
        .select('id, renamed_name, original_name, doc_type, folder')
        .eq('org_id', orgId)
        .textSearch('search_vector', query, { type: 'websearch', config: 'english' })
        .order('created_at', { ascending: false })
        .limit(limit),

      supabase
        .from('ledger_entries')
        .select('id, description, entry_date, debit, credit')
        .eq('org_id', orgId)
        .textSearch('search_vector', query, { type: 'websearch', config: 'english' })
        .order('entry_date', { ascending: false })
        .limit(limit),

      supabase
        .from('extracted_records')
        .select('id, vendor_name, transaction_date')
        .eq('org_id', orgId)
        .ilike('vendor_name', `%${query}%`)
        .order('transaction_date', { ascending: false })
        .limit(limit),
    ])

    const results: SearchResult[] = []

    for (const d of (docsResult.data ?? [])) {
      results.push({
        id: d.id,
        type: 'document',
        title: d.renamed_name ?? d.original_name ?? 'Untitled',
        subtitle: [d.doc_type, d.folder].filter(Boolean).join(' · '),
        url: `/documents/${d.id}`,
      })
    }

    for (const e of (entriesResult.data ?? [])) {
      results.push({
        id: e.id,
        type: 'transaction',
        title: e.description ?? 'Transaction',
        subtitle: `${e.entry_date} · ${e.debit > 0 ? `Debit $${e.debit}` : `Credit $${e.credit}`}`,
        url: `/ledger?highlight=${e.id}`,
      })
    }

    const seenVendors = new Set<string>()
    for (const v of (vendorsResult.data ?? [])) {
      if (v.vendor_name && !seenVendors.has(v.vendor_name)) {
        seenVendors.add(v.vendor_name)
        results.push({
          id: v.id,
          type: 'vendor',
          title: v.vendor_name,
          subtitle: `Last seen: ${v.transaction_date ?? 'unknown'}`,
          url: `/documents?vendor=${encodeURIComponent(v.vendor_name)}`,
        })
      }
    }

    return results
  },
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/faris/Documents/Humaris && npx vitest run src/lib/search/__tests__/search.test.ts --reporter=verbose 2>&1
```

Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/search/index.ts src/lib/search/__tests__/search.test.ts
git commit -m "feat: upgrade search library to Postgres FTS with SearchProvider interface"
```

---

## Task 3: API route + tests

**Files:**
- Create: `src/app/api/search/route.ts`
- Create: `src/app/api/search/__tests__/route.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/app/api/search/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth/session', () => ({
  requireSession: vi.fn(),
}))

vi.mock('@/lib/search', () => ({
  postgresSearchProvider: { search: vi.fn() },
}))

import { requireSession } from '@/lib/auth/session'
import { postgresSearchProvider } from '@/lib/search'
import { GET } from '../route'

const mockSession = { org: { id: 'org1' }, role: 'owner', user: { id: 'u1' } }

describe('GET /api/search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(requireSession as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession)
    ;(postgresSearchProvider.search as ReturnType<typeof vi.fn>).mockResolvedValue([])
  })

  it('returns 400 when q is missing', async () => {
    const req = new NextRequest('http://localhost/api/search')
    const res = await GET(req)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('q is required')
  })

  it('returns 400 when q is shorter than 2 characters', async () => {
    const req = new NextRequest('http://localhost/api/search?q=a')
    const res = await GET(req)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Query must be at least 2 characters')
  })

  it('returns results with correct shape for valid query', async () => {
    ;(postgresSearchProvider.search as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'd1', type: 'document', title: 'Invoice', subtitle: 'Invoices', url: '/documents/d1' },
    ])
    const req = new NextRequest('http://localhost/api/search?q=invoice')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.results).toHaveLength(1)
    expect(body.total).toBe(1)
    expect(body.query).toBe('invoice')
  })

  it('truncates query to 100 characters before searching', async () => {
    const longQuery = 'a'.repeat(150)
    const req = new NextRequest(`http://localhost/api/search?q=${longQuery}`)
    await GET(req)
    expect(postgresSearchProvider.search).toHaveBeenCalledWith('a'.repeat(100), 'org1')
  })

  it('returns 500 and generic message on search error', async () => {
    ;(postgresSearchProvider.search as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB error'))
    const req = new NextRequest('http://localhost/api/search?q=test')
    const res = await GET(req)
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('Search failed')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/faris/Documents/Humaris && npx vitest run "src/app/api/search/__tests__/route.test.ts" --reporter=verbose 2>&1
```

Expected: FAIL — `Cannot find module '../route'`.

- [ ] **Step 3: Create src/app/api/search/route.ts**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { postgresSearchProvider } from '@/lib/search'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const session = await requireSession()

  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')

    if (!q) {
      return NextResponse.json({ error: 'q is required' }, { status: 400 })
    }

    if (q.trim().length < 2) {
      return NextResponse.json({ error: 'Query must be at least 2 characters' }, { status: 400 })
    }

    if (!session.org) {
      return NextResponse.json({ error: 'No organization context' }, { status: 400 })
    }

    const truncatedQuery = q.trim().slice(0, 100)
    const results = await postgresSearchProvider.search(truncatedQuery, session.org.id)

    return NextResponse.json({
      results,
      query: truncatedQuery,
      total: results.length,
    })
  } catch {
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/faris/Documents/Humaris && npx vitest run "src/app/api/search/__tests__/route.test.ts" --reporter=verbose 2>&1
```

Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/search/route.ts" "src/app/api/search/__tests__/route.test.ts"
git commit -m "feat: GET /api/search route with FTS and auth"
```

---

## Task 4: useSearch hook + tests

**Files:**
- Create: `src/hooks/use-search.ts`
- Create: `src/hooks/__tests__/use-search.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/hooks/__tests__/use-search.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/faris/Documents/Humaris && npx vitest run src/hooks/__tests__/use-search.test.ts --reporter=verbose 2>&1
```

Expected: FAIL — `Cannot find module '../use-search'`.

- [ ] **Step 3: Create src/hooks/use-search.ts**

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/faris/Documents/Humaris && npx vitest run src/hooks/__tests__/use-search.test.ts --reporter=verbose 2>&1
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-search.ts src/hooks/__tests__/use-search.test.ts
git commit -m "feat: useSearch hook with debounce and groupResults"
```

---

## Task 5: SearchResultItem component

**Files:**
- Create: `src/components/search/search-result-item.tsx`

- [ ] **Step 1: Create search-result-item.tsx**

Create `src/components/search/search-result-item.tsx`:

```tsx
'use client'

import { FileText, ArrowLeftRight, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SearchResult } from '@/lib/search'

const ICONS: Record<SearchResult['type'], React.ElementType> = {
  document: FileText,
  transaction: ArrowLeftRight,
  vendor: Building2,
}

const TYPE_LABELS: Record<SearchResult['type'], string> = {
  document: 'Doc',
  transaction: 'Txn',
  vendor: 'Vendor',
}

interface SearchResultItemProps {
  result: SearchResult
  isFocused: boolean
  onClick: () => void
}

export function SearchResultItem({ result, isFocused, onClick }: SearchResultItemProps) {
  const Icon = ICONS[result.type]
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
        isFocused ? 'bg-gray-50' : 'hover:bg-gray-50'
      )}
    >
      <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
        <Icon className="w-3.5 h-3.5 text-gray-600" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900 truncate">{result.title}</p>
        <p className="text-xs text-gray-400 truncate">{result.subtitle}</p>
      </div>
      <span className="flex-shrink-0 text-xs text-gray-300 font-mono">{TYPE_LABELS[result.type]}</span>
    </button>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/search/search-result-item.tsx
git commit -m "feat: SearchResultItem component"
```

---

## Task 6: SearchOverlay component

**Files:**
- Create: `src/components/search/search-overlay.tsx`

- [ ] **Step 1: Create search-overlay.tsx**

Create `src/components/search/search-overlay.tsx`:

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/search/search-overlay.tsx
git commit -m "feat: SearchOverlay component with Cmd+K trigger and keyboard navigation"
```

---

## Task 7: Wire SearchOverlay into app shell

**Files:**
- Modify: `src/components/layout/app-shell.tsx`

Read `src/components/layout/app-shell.tsx` before editing.

- [ ] **Step 1: Add SearchOverlay import and hint to NAV_ITEMS**

Make three changes to `app-shell.tsx`:

**Change 1:** Add the import after the existing imports:
```ts
import { SearchOverlay } from '@/components/search/search-overlay'
```

**Change 2:** Update the `NAV_ITEMS` type and array. Replace the existing `NAV_ITEMS` declaration with:

```ts
const NAV_ITEMS: { href: string; label: string; icon: React.ElementType; hint?: string }[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/upload', label: 'Upload Files', icon: Upload },
  { href: '/documents', label: 'Documents', icon: FolderOpen },
  { href: '/extraction', label: 'Review Queue', icon: ClipboardCheck },
  { href: '/ledger', label: 'Ledger', icon: BookOpen },
  { href: '/statements', label: 'Statements', icon: BarChart3 },
  { href: '/templates', label: 'Templates', icon: FileText },
  { href: '/search', label: 'Search', icon: Search, hint: '⌘K' },
  { href: '/settings', label: 'Settings', icon: Settings },
]
```

**Change 3:** In the nav item render loop, add the hint badge. Find the existing nav link JSX inside the `NAV_ITEMS.map(...)` and add the hint after the `{isActive && <ChevronRight ... />}`:

The current link body ends with:
```tsx
<Icon className="w-4 h-4 shrink-0" />
{label}
{isActive && <ChevronRight className="w-3 h-3 ml-auto text-gray-400" />}
```

Replace with:
```tsx
<Icon className="w-4 h-4 shrink-0" />
{label}
{hint && !isActive && (
  <span className="ml-auto text-[10px] text-gray-400 font-mono">{hint}</span>
)}
{isActive && <ChevronRight className="w-3 h-3 ml-auto text-gray-400" />}
```

Note: destructure `hint` from the map callback: `{ href, label, icon: Icon, hint }`.

**Change 4:** Mount `<SearchOverlay />` inside the `<main>` element, before `<DuplicateBanner />` or after `{children}`. The simplest position is just before the closing `</main>` tag:

Find:
```tsx
      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <DuplicateBanner />
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
```

Replace with:
```tsx
      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <DuplicateBanner />
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
        <SearchOverlay />
      </main>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/app-shell.tsx
git commit -m "feat: mount SearchOverlay in app shell; add ⌘K hint to Search nav item"
```

---

## Task 8: Full-page search

**Files:**
- Modify: `src/app/(app)/search/page.tsx`

Read the current file (it is a placeholder) before replacing.

- [ ] **Step 1: Replace search/page.tsx**

Replace the full contents of `src/app/(app)/search/page.tsx`:

```tsx
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
    <div className="p-8 max-w-3xl mx-auto space-y-6">
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
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/(app)/search/page.tsx"
git commit -m "feat: full-page search with URL sync"
```

---

## Task 9: Final push

- [ ] **Step 1: Run all search-related tests**

```bash
cd /Users/faris/Documents/Humaris && npx vitest run src/lib/search src/app/api/search src/hooks/__tests__/use-search.test.ts --reporter=verbose 2>&1
```

Expected: all 13 tests PASS (5 search library + 5 API route + 3 groupResults).

- [ ] **Step 2: Push to remote**

```bash
git push humarisremote main
```

---

## Self-Review

**Spec coverage:**
- DB migration with generated tsvector columns ✓ Task 1
- Upgrade `search()` from ilike to FTS ✓ Task 2
- `SearchProvider` interface + `ExternalSearchProvider` stub ✓ Task 2
- `GET /api/search?q=` route with auth, validation, truncation ✓ Task 3
- `useSearch` hook with debounce ✓ Task 4
- `groupResults` pure function ✓ Task 4
- `<SearchResultItem>` component ✓ Task 5
- `<SearchOverlay>` with Cmd+K trigger ✓ Task 6
- Keyboard navigation (↑↓ Enter Esc) ✓ Task 6
- Mount overlay in app shell ✓ Task 7
- ⌘K hint in nav ✓ Task 7
- `/search` full-page with URL sync ✓ Task 8
- Loading skeleton, empty state, error state ✓ Tasks 6 & 8
- Unit tests: search library, API route, groupResults ✓ Tasks 2, 3, 4

**Type consistency check:**
- `SearchResult` defined in Task 2, imported consistently in Tasks 3-8 ✓
- `SearchResponse` defined in Task 4, used in Tasks 6 & 8 ✓
- `postgresSearchProvider` exported from `@/lib/search`, imported in Task 3 ✓
- `groupResults` exported from `@/hooks/use-search`, imported in Task 6 ✓
- `SearchResultItem` props: `result: SearchResult`, `isFocused: boolean`, `onClick: () => void` — used consistently in Tasks 6 & 8 ✓
