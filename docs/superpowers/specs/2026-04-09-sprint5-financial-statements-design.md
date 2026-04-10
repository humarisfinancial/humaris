# Sprint 5 — Financial Statement Generator: Design Spec

**Date:** 2026-04-09
**Sprint:** 5 of 8
**Status:** Approved

---

## Overview

Sprint 5 builds the Financial Statement Generator: auto-generated P&L, Balance Sheet, and Statement of Cash Flows from the ledger data produced in Sprint 4. Statements are cached for performance, support accordion drill-down to source documents, and export to PDF, XLSX, and CSV.

---

## Scope

**In scope:**
- P&L, Balance Sheet, Statement of Cash Flows
- Period selection: MTD, QTD, YTD, custom date range
- Accordion drill-down: summary → category → individual transactions → source document
- Export: PDF, XLSX, CSV
- Uncategorized transaction flagging with inline categorize links
- Cached snapshot architecture using the existing `financial_statements` table
- New `/statements` route (split from `/templates`)
- RBAC enforcement on export (Accountant and above)

**Deferred to Data Organization Engine sprint:**
- User-uploadable custom templates

---

## Architecture & Data Flow

### Cached Snapshot Model

All statement data is computed from `ledger_entries` + `chart_of_accounts` and cached in the existing `financial_statements` table `(id, org_id, type, period_start, period_end, data jsonb, generated_at)`.

**Request flow:**
1. User selects statement type + period on `/statements`
2. `GET /api/statements/[type]?from=YYYY-MM-DD&to=YYYY-MM-DD` is called
3. API looks up `financial_statements` for matching `(org_id, type, period_start, period_end)`
4. **Cache hit** → return stored `data` JSON
5. **Cache miss** → compute from ledger → write to `financial_statements` → return
6. **Force refresh** → `POST /api/statements/[type]/refresh` busts cache and recomputes

**Cache invalidation:**
Any mutation to `ledger_entries` (create, update, delete) deletes all cached `financial_statements` rows for that org. The cache is a pure derivative — the ledger is the source of truth.

### New Code

```
src/
├── lib/
│   ├── statements/
│   │   ├── types.ts              ← StatementData, LineItem, StatementPeriod
│   │   ├── pnl.ts                ← P&L computation
│   │   ├── balance-sheet.ts      ← Balance Sheet computation
│   │   ├── cash-flow.ts          ← Cash Flow computation
│   │   └── export.ts             ← PDF / XLSX / CSV generation
│   └── db/repositories/
│       └── statement-repository.ts  ← cache reads/writes
└── app/
    ├── (app)/statements/
    │   └── page.tsx              ← statements UI
    └── api/statements/
        ├── [type]/
        │   ├── route.ts          ← GET: fetch or compute statement
        │   └── refresh/
        │       └── route.ts      ← POST: force recompute
        └── export/
            └── route.ts          ← GET: generate file download
```

### Modified Files

- `src/app/api/ledger/route.ts` and `src/app/api/ledger/[id]/route.ts` — add cache-bust call on mutations
- `src/app/(app)/layout.tsx` — add "Statements" nav link

---

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/statements/[type]` | Fetch or compute+cache a statement. `type`: `pnl`, `balance`, `cashflow`. Params: `from`, `to` (YYYY-MM-DD). |
| POST | `/api/statements/[type]/refresh` | Force recompute, bust cache, return fresh data. |
| GET | `/api/statements/export` | Generate and stream file. Params: `type`, `from`, `to`, `format` (`pdf`, `xlsx`, `csv`). |

Route handlers are thin — validate params, delegate to `src/lib/statements/`, return result.

---

## Computation Libraries

| Format | Library | Notes |
|--------|---------|-------|
| PDF | `@react-pdf/renderer` | Renders a React component tree to PDF; clean print layout |
| XLSX | `xlsx` (SheetJS) | Serializes statement data to formatted spreadsheet |
| CSV | Native | Flatten statement tree to rows; no dependency |

---

## UI Design

### Layout (`/statements`)

Apple-inspired: `system-ui` font, white background, `#f5f5f7` section separators, generous whitespace, data-first — no decorative chrome.

```
┌─────────────────────────────────────────────────────────┐
│  Financial Statements                    [Export ▾]      │
│                                                          │
│  [P&L]  [Balance Sheet]  [Cash Flow]                    │
│                                                          │
│  MTD  QTD  YTD  │  Jan 1 – Mar 31, 2026  [↺ Refresh]  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  REVENUE                                    $124,500     │
│  ▶  Product Sales                            $98,000     │
│     ▶  Invoice – Acme Corp  Mar 12           $12,000     │
│        ▶  [source doc link]                             │
│  ▶  Service Revenue                          $26,500     │
│                                                          │
│  ⚠  Uncategorized (3)                         $4,200    │
│     Entry #142 – Mar 5               $1,800  [Categorize]│
│                                                          │
│  GROSS PROFIT                               $87,150      │
│  ─────────────────────────────────────────────────────  │
│  NET INCOME                                 $31,400      │
└─────────────────────────────────────────────────────────┘
```

### Design Tokens

- Font: `system-ui, -apple-system, BlinkMacSystemFont` (SF Pro stack)
- Background: `#ffffff`
- Section separators: `#f5f5f7`
- Section headers: semibold, slightly larger
- Line items: regular weight
- Numbers: right-aligned, fixed-width column
- Labels: left-aligned
- Expandable rows: `▶` chevron rotates 90° on expand, subtle hover state
- Uncategorized: amber `⚠` badge, amber left border on row
- "Categorize" link: deep-links to `/ledger?entry=<id>`

### Period Selector

Pill buttons: **MTD / QTD / YTD** + date range picker for custom ranges. Selecting any option re-fetches automatically. A "Last generated" timestamp sits next to the Refresh button.

### Export

Dropdown button top-right: **PDF / XLSX / CSV**. Triggers direct file download. No modal.

### RBAC

- All roles: can view statements
- Export restricted to: Accountant / Bookkeeper and above
- Operations User and Read-Only Viewer see the Export button disabled with a tooltip

---

## Error Handling & Edge Cases

| Scenario | Behaviour |
|----------|-----------|
| No ledger data for period | Empty state: "No transactions found for this period" + link to `/ledger` |
| Balance Sheet imbalance (A ≠ L + E) | Amber warning banner above statement; data still rendered |
| Uncategorized transactions | Shown in amber "Uncategorized" section at bottom; excluded from totals with a note showing excluded sum |
| Export failure | Toast: "Export failed — please try again." Error logged server-side. |
| Stale cache | Automatically invalidated on any ledger mutation. "Last generated" timestamp always visible. |

---

## Testing

- **Unit:** Each computation function (`pnl.ts`, `balance-sheet.ts`, `cash-flow.ts`) tested with known ledger fixtures asserting correct line items and totals
- **API:** Route tests for cache hit, cache miss, and force-refresh flows
- **Export:** Tests asserting PDF/XLSX/CSV output contains expected line items and structure

---

## Financial Statement Definitions

| Statement | Key Lines |
|-----------|-----------|
| P&L | Revenue, COGS, Gross Profit, Operating Expenses, Operating Income, Net Income |
| Balance Sheet | Assets, Liabilities, Equity (must satisfy: Assets = Liabilities + Equity) |
| Cash Flow | Operating Activities, Investing Activities, Financing Activities, Net Cash Flow |
