# Sprint 7 — Global Platform Search: Design Spec

**Date:** 2026-04-11
**Sprint:** 7 of 8
**Status:** Approved

---

## Overview

Sprint 7 builds the Global Platform Search — a Cmd+K triggered floating overlay plus a dedicated `/search` page that lets users find documents, transactions, and vendors across the entire platform. Search is powered by Postgres full-text search (FTS) via generated `tsvector` columns on `documents` and `ledger_entries`, replacing the existing `ilike` implementation in `src/lib/search/index.ts`.

---

## Scope

**In scope:**
- DB migration: generated `tsvector` columns on `documents` and `ledger_entries` with GIN indexes
- Upgrade `src/lib/search/index.ts` from `ilike` to `websearch_to_tsquery` FTS
- Formalize `SearchProvider` interface (Postgres implementation; Gmail/Slack stubs as type definitions only)
- `GET /api/search?q=` route
- `<SearchOverlay>` component: Cmd+K / Ctrl+K floating modal, grouped results, keyboard navigation
- `/search` full-page search (replaces placeholder)
- Mount `<SearchOverlay>` in `app-shell.tsx`
- TanStack Query hook: `useSearch`
- Unit tests for the upgraded search function

**Deferred:**
- Gmail / Slack / external connector implementations
- Saved searches
- Search filters (by date range, doc type, amount)
- Search analytics / query logging

---

## Architecture & Data Flow

### Option chosen: Generated tsvector columns (Option A)

No new tables. Generated columns on existing tables auto-maintain their FTS vectors on every insert/update — no indexing pipeline, no async jobs.

**Migration (`supabase/migrations/006_search_vectors.sql`):**

```sql
ALTER TABLE documents ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(renamed_name, '') || ' ' ||
      coalesce(original_name, '') || ' ' ||
      coalesce(doc_type, '') || ' ' ||
      coalesce(folder, ''))
  ) STORED;

ALTER TABLE ledger_entries ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(description, '') || ' ' ||
      coalesce(category, ''))
  ) STORED;

CREATE INDEX idx_documents_search_vector ON documents USING gin(search_vector);
CREATE INDEX idx_ledger_entries_search_vector ON ledger_entries USING gin(search_vector);
```

Note: The existing `document_search` and `transaction_search` tables (scaffolded in migration 001) are superseded by the generated columns and are not used.

### Request flow

```
User presses Cmd+K
  → <SearchOverlay> opens, input autofocuses
  → User types (debounce 200ms, min 2 chars)
  → GET /api/search?q=<query>
  → requireSession() + RBAC check
  → PostgresSearchProvider.search(query, orgId)
      → 3 parallel queries (documents, ledger_entries, extracted_records)
      → results ranked by ts_rank
  → Returns SearchResult[] grouped by type
  → Overlay renders grouped results
  → Click → navigate to result URL, overlay closes
```

### New code

```
src/
├── lib/search/
│   └── index.ts                     ← Upgrade: SearchProvider interface + PostgresSearchProvider
├── hooks/
│   └── use-search.ts                ← TanStack Query hook with 200ms debounce
├── components/search/
│   ├── search-overlay.tsx           ← Cmd+K modal: input + grouped results + keyboard nav
│   └── search-result-item.tsx       ← Single result row (icon, title, subtitle)
└── app/
    ├── (app)/search/
    │   └── page.tsx                 ← Full-page search results
    └── api/search/
        └── route.ts                 ← GET /api/search?q=
```

**Modified:**
- `src/components/layout/app-shell.tsx` — mount `<SearchOverlay>` once, add Cmd+K hint to Search nav item
- `supabase/migrations/006_search_vectors.sql` — new file

---

## SearchProvider Interface

```ts
export interface SearchResult {
  id: string
  type: 'document' | 'transaction' | 'vendor'
  title: string
  subtitle: string
  url: string
  score?: number
}

export interface SearchProvider {
  search(query: string, orgId: string, limit?: number): Promise<SearchResult[]>
}

// Future stub — no implementation for MVP
export interface ExternalSearchProvider extends SearchProvider {
  readonly providerName: string  // e.g. 'gmail' | 'slack'
}
```

`PostgresSearchProvider` is the default implementation. The API route instantiates it directly — no factory or registry needed for MVP.

---

## API Route

### `GET /api/search`

Query params: `q` (string, required)

**Validation:**
- `q` missing → 400 `{ error: 'q is required' }`
- `q` < 2 chars → 400 `{ error: 'Query must be at least 2 characters' }`
- `q` truncated to 100 chars before passing to search

**Auth:** `requireSession()` before try/catch (same pattern as KPI routes). All roles permitted.

**Response:**
```ts
{
  results: SearchResult[]
  query: string
  total: number
}
```

**Error:** Generic `{ error: 'Search failed' }` with 500 — no internal detail leaked.

---

## Search Implementation

### `PostgresSearchProvider.search()`

Three parallel queries using `websearch_to_tsquery`:

**Documents:**
```sql
SELECT id, renamed_name, original_name, doc_type, folder,
       ts_rank(search_vector, query) AS rank
FROM documents, websearch_to_tsquery('english', $1) query
WHERE org_id = $2
  AND search_vector @@ query
ORDER BY rank DESC
LIMIT $3
```

**Ledger entries:**
```sql
SELECT id, description, entry_date, debit, credit,
       ts_rank(search_vector, query) AS rank
FROM ledger_entries, websearch_to_tsquery('english', $1) query
WHERE org_id = $2
  AND search_vector @@ query
ORDER BY rank DESC
LIMIT $3
```

**Vendors (extracted_records — `ilike` retained, no FTS column here):**
```sql
SELECT DISTINCT ON (vendor_name) id, vendor_name, transaction_date
FROM extracted_records
WHERE org_id = $2
  AND vendor_name ILIKE $1
LIMIT $3
```

Note: `extracted_records` retains `ilike` since it has no `search_vector` column. Vendor search is name-only and `ilike` is sufficient.

Results from all three are merged and returned as `SearchResult[]`. The API route groups them by type before returning.

### Query safety

`websearch_to_tsquery` is a parameterised Postgres function — user input is passed as a bound parameter, not interpolated into SQL. No SQL injection risk. The existing `indexDocument()` function (which had unsafe string interpolation) will be removed and replaced with the generated column approach.

---

## UI Components

### `<SearchOverlay>`

- Fixed full-screen semi-transparent backdrop (`bg-black/40`)
- Centered card: max-width 560px, `rounded-2xl`, white background
- Search input at top with magnifier icon and `Esc` hint
- Results below, divided into sections: **Documents**, **Transactions**, **Vendors**
- Up to 5 results per section; "See all results →" link to `/search?q=` if more exist
- Keyboard navigation: ↑↓ moves highlight, Enter navigates, Esc closes
- Click outside backdrop → closes
- Mounted once in `<AppShell>` — persists across page navigations

### `<SearchResultItem>`

```
┌────────────────────────────────────────────┐
│  [icon]  Title                      [type] │
│          Subtitle (date, amount, folder)   │
└────────────────────────────────────────────┘
```

- Document icon: `FileText` (lucide)
- Transaction icon: `ArrowLeftRight` (lucide)
- Vendor icon: `Building2` (lucide)
- Highlighted on hover and keyboard focus

### `/search` page

Full-page version of the same results. No grouping limit — shows up to 20 results, paginated with "Load more". Same `useSearch` hook. URL query param `?q=` kept in sync with the input so the URL is shareable.

### `useSearch` hook

```ts
export function useSearch(query: string) {
  const debouncedQuery = useDebounce(query, 200)
  return useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`).then(...),
    enabled: debouncedQuery.length >= 2,
  })
}
```

`useDebounce` is a small inline hook (no external dependency needed).

---

## Keyboard Shortcut

Mounted in `<SearchOverlay>` via `useEffect`:

```ts
useEffect(() => {
  function handleKeyDown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      setOpen(true)
    }
  }
  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}, [])
```

The Search nav item in the sidebar gains a `⌘K` badge on the right side (visible on Mac, `Ctrl+K` on Windows/Linux).

---

## Edge Cases & Error Handling

| Scenario | Behaviour |
|---|---|
| Query < 2 chars | No fetch — show "Type to search…" placeholder |
| No results | "No results for '…'" empty state with suggestion to check spelling |
| API error | "Search unavailable" inline message — no toast |
| Query > 100 chars | Truncated client-side before sending |
| Special FTS characters | `websearch_to_tsquery` handles safely — passed as bound parameter |
| Overlay open during navigation | Overlay closes on route change |

---

## RBAC

All authenticated org members can search. No new permission key required. The API route checks `requireSession()` only — same access level as viewing documents and the ledger.

---

## Testing

- **Unit:** `PostgresSearchProvider.search()` with mocked Supabase client — assert correct result shapes for documents, transactions, and vendors
- **Unit:** Query edge cases — empty string (should not reach search; validated at API layer), single word, multi-word, quoted phrase
- **Unit:** `useDebounce` hook — assert value is not emitted until delay has passed
- **API:** Route tests — missing `q`, `q` too short, valid query returning results, Supabase error propagation
