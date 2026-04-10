# Financial Statement Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Financial Statement Generator — P&L, Balance Sheet, and Cash Flow statements auto-computed from ledger data, cached in `financial_statements`, with accordion drill-down and PDF/XLSX/CSV export.

**Architecture:** Statement data is computed from `ledger_entries` + `chart_of_accounts` and cached in the `financial_statements` table. The ledger API busts this cache on every mutation. Computation logic lives in `src/lib/statements/`; route handlers are thin wrappers.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase, TanStack Query, `xlsx` (SheetJS), `@react-pdf/renderer`, shadcn/ui, Tailwind CSS, Vitest

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/types/index.ts` | Add `entry_id`, `source_doc_id`, `entry_date` to `StatementSection` |
| Create | `src/lib/statements/pnl.ts` | P&L computation |
| Create | `src/lib/statements/balance-sheet.ts` | Balance Sheet computation |
| Create | `src/lib/statements/cash-flow.ts` | Cash Flow computation |
| Create | `src/lib/statements/export.ts` | PDF / XLSX / CSV generation |
| Create | `src/lib/db/repositories/statement-repository.ts` | Cache read/write/clear |
| Create | `src/app/api/statements/[type]/route.ts` | GET: fetch or compute+cache |
| Create | `src/app/api/statements/[type]/refresh/route.ts` | POST: force recompute |
| Create | `src/app/api/statements/export/route.ts` | GET: stream file download |
| Modify | `src/app/api/ledger/route.ts` | Bust statement cache on POST |
| Modify | `src/app/api/ledger/[id]/route.ts` | Bust statement cache on PATCH/DELETE |
| Create | `src/hooks/use-statements.ts` | TanStack Query hooks |
| Create | `src/components/statements/period-selector.tsx` | MTD/QTD/YTD + date range picker |
| Create | `src/components/statements/statement-table.tsx` | Accordion statement table |
| Create | `src/components/statements/export-button.tsx` | PDF/XLSX/CSV dropdown |
| Create | `src/app/(app)/statements/page.tsx` | Statements page |
| Modify | `src/components/layout/app-shell.tsx` | Add Statements nav link |
| Create | `vitest.config.ts` | Vitest configuration |
| Create | `src/lib/statements/__tests__/pnl.test.ts` | P&L unit tests |
| Create | `src/lib/statements/__tests__/balance-sheet.test.ts` | Balance Sheet unit tests |
| Create | `src/lib/statements/__tests__/cash-flow.test.ts` | Cash Flow unit tests |

---

## Task 1: Install dependencies + Vitest setup

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (scripts only — `npm install` handles deps)

- [ ] **Step 1: Install new packages**

```bash
cd /Users/faris/Documents/Humaris
npm install xlsx @react-pdf/renderer
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/dom jsdom @types/react
```

Expected: packages added to node_modules with no peer-dep errors.

- [ ] **Step 2: Create vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 3: Add test script to package.json**

In `package.json`, add `"test": "vitest run"` to the `scripts` block:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test": "vitest run"
}
```

- [ ] **Step 4: Verify Vitest runs**

```bash
npx vitest run --reporter=verbose 2>&1 | head -20
```

Expected: output like `No test files found` or a clean pass — no config errors.

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts package.json package-lock.json
git commit -m "chore: add xlsx, @react-pdf/renderer, vitest"
```

---

## Task 2: Extend StatementSection type + StatementRepository

**Files:**
- Modify: `src/types/index.ts` (lines 188–193)
- Create: `src/lib/db/repositories/statement-repository.ts`
- Create: `src/lib/statements/__tests__/statement-repository.test.ts`

The existing `StatementSection` needs three optional fields to support the accordion drill-down to individual entries and source documents.

- [ ] **Step 1: Extend StatementSection in types.ts**

Find this block in `src/types/index.ts`:

```ts
export interface StatementSection {
  label: string
  code?: string
  amount: number
  children?: StatementSection[]
}
```

Replace with:

```ts
export interface StatementSection {
  label: string
  code?: string
  amount: number
  entry_id?: string
  source_doc_id?: string | null
  entry_date?: string
  children?: StatementSection[]
}
```

- [ ] **Step 2: Write the failing test**

Create `src/lib/statements/__tests__/statement-repository.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase client
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
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx vitest run src/lib/statements/__tests__/statement-repository.test.ts --reporter=verbose
```

Expected: FAIL — `Cannot find module '../../../lib/db/repositories/statement-repository'`

- [ ] **Step 4: Create StatementRepository**

Create `src/lib/db/repositories/statement-repository.ts`:

```ts
import { createServerSupabaseClient } from '@/lib/db/server'
import type { FinancialStatement, StatementData, StatementType } from '@/types'

export const StatementRepository = {
  async getCached(
    orgId: string,
    type: StatementType,
    periodStart: string,
    periodEnd: string
  ): Promise<FinancialStatement | null> {
    const supabase = await createServerSupabaseClient()
    const { data } = await supabase
      .from('financial_statements')
      .select('*')
      .eq('org_id', orgId)
      .eq('type', type)
      .eq('period_start', periodStart)
      .eq('period_end', periodEnd)
      .single()
    return data ?? null
  },

  async saveCache(
    orgId: string,
    type: StatementType,
    periodStart: string,
    periodEnd: string,
    data: StatementData,
    generatedBy: string | null
  ): Promise<FinancialStatement> {
    const supabase = await createServerSupabaseClient()

    // Upsert — delete existing then insert fresh
    await supabase
      .from('financial_statements')
      .delete()
      .eq('org_id', orgId)
      .eq('type', type)
      .eq('period_start', periodStart)
      .eq('period_end', periodEnd)

    const { data: row, error } = await supabase
      .from('financial_statements')
      .insert({
        org_id: orgId,
        type,
        period_start: periodStart,
        period_end: periodEnd,
        data,
        generated_by: generatedBy,
      })
      .select('*')
      .single()

    if (error) throw new Error(`Failed to cache statement: ${error.message}`)
    return row
  },

  async clearCacheForOrg(orgId: string): Promise<void> {
    const supabase = await createServerSupabaseClient()
    await supabase
      .from('financial_statements')
      .delete()
      .eq('org_id', orgId)
  },
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run src/lib/statements/__tests__/statement-repository.test.ts --reporter=verbose
```

Expected: all 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/types/index.ts src/lib/db/repositories/statement-repository.ts src/lib/statements/__tests__/statement-repository.test.ts
git commit -m "feat: statement repository + StatementSection drill-down fields"
```

---

## Task 3: P&L computation

**Files:**
- Create: `src/lib/statements/pnl.ts`
- Create: `src/lib/statements/__tests__/pnl.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/statements/__tests__/pnl.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/db/repositories/ledger-repository', () => ({
  LedgerRepository: {
    list: vi.fn(),
  },
}))

import { LedgerRepository } from '@/lib/db/repositories/ledger-repository'
import { computePnL } from '../../../lib/statements/pnl'

const mockEntries = [
  {
    id: 'e1', account_id: 'a1', debit: 0, credit: 5000, category: 'consulting',
    entry_date: '2026-01-15', description: 'Invoice Acme', source_doc_id: 'doc1',
    account: { id: 'a1', code: '4000', name: 'Service Revenue', type: 'revenue' },
  },
  {
    id: 'e2', account_id: 'a2', debit: 2000, credit: 0, category: 'software',
    entry_date: '2026-01-20', description: 'AWS bill', source_doc_id: null,
    account: { id: 'a2', code: '6000', name: 'Software Expenses', type: 'expense' },
  },
  {
    id: 'e3', account_id: 'a3', debit: 500, credit: 0, category: null,
    entry_date: '2026-01-25', description: 'Unknown charge', source_doc_id: null,
    account: { id: 'a3', code: '6999', name: 'Misc', type: 'expense' },
  },
]

describe('computePnL', () => {
  it('produces correct revenue, expenses, and net income', async () => {
    ;(LedgerRepository.list as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: mockEntries,
      total: 3,
      page: 1,
      per_page: 10000,
      has_more: false,
    })

    const result = await computePnL('org-1', '2026-01-01', '2026-01-31')

    expect(result.totals.revenue).toBe(5000)
    expect(result.totals.expenses).toBe(2500)
    expect(result.totals.net_income).toBe(2500)
  })

  it('puts entries with null category in uncategorized metadata', async () => {
    ;(LedgerRepository.list as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: mockEntries,
      total: 3,
      page: 1,
      per_page: 10000,
      has_more: false,
    })

    const result = await computePnL('org-1', '2026-01-01', '2026-01-31')
    expect(result.metadata.uncategorized_count).toBe(1)
  })

  it('returns empty sections with zero totals when no entries', async () => {
    ;(LedgerRepository.list as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: [], total: 0, page: 1, per_page: 10000, has_more: false,
    })

    const result = await computePnL('org-1', '2026-01-01', '2026-01-31')
    expect(result.totals.net_income).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/statements/__tests__/pnl.test.ts --reporter=verbose
```

Expected: FAIL — `Cannot find module '../../../lib/statements/pnl'`

- [ ] **Step 3: Implement computePnL**

Create `src/lib/statements/pnl.ts`:

```ts
import { LedgerRepository } from '@/lib/db/repositories/ledger-repository'
import type { StatementData, StatementSection, LedgerEntry, ChartOfAccount } from '@/types'

interface AccountGroup {
  account: ChartOfAccount
  entries: LedgerEntry[]
}

function buildAccountSections(
  groups: AccountGroup[],
  balanceType: 'debit' | 'credit'
): StatementSection[] {
  return groups.map(({ account, entries }) => {
    const entryChildren: StatementSection[] = entries.map(e => ({
      label: e.description ?? `Entry ${e.id.slice(0, 8)}`,
      amount:
        balanceType === 'debit'
          ? Number(e.debit) - Number(e.credit)
          : Number(e.credit) - Number(e.debit),
      entry_id: e.id,
      source_doc_id: e.source_doc_id,
      entry_date: e.entry_date,
    }))
    return {
      label: account.name,
      code: account.code,
      amount: entryChildren.reduce((s, c) => s + c.amount, 0),
      children: entryChildren,
    }
  })
}

export async function computePnL(
  orgId: string,
  from: string,
  to: string
): Promise<StatementData> {
  const { items: entries } = await LedgerRepository.list(
    orgId,
    { date_from: from, date_to: to },
    { per_page: 10000 }
  )

  const byAccount = new Map<string, AccountGroup>()
  const uncategorized: LedgerEntry[] = []

  for (const entry of entries) {
    if (!entry.account) continue
    if (!byAccount.has(entry.account_id)) {
      byAccount.set(entry.account_id, { account: entry.account, entries: [] })
    }
    byAccount.get(entry.account_id)!.entries.push(entry)
    if (entry.category === null) uncategorized.push(entry)
  }

  const groups = [...byAccount.values()]
  const revenueGroups = groups.filter(g => g.account.type === 'revenue')
  const expenseGroups = groups.filter(g => g.account.type === 'expense')

  const revenueChildren = buildAccountSections(revenueGroups, 'credit')
  const expenseChildren = buildAccountSections(expenseGroups, 'debit')

  const totalRevenue = revenueChildren.reduce((s, c) => s + c.amount, 0)
  const totalExpenses = expenseChildren.reduce((s, c) => s + c.amount, 0)
  const netIncome = totalRevenue - totalExpenses

  return {
    sections: [
      { label: 'REVENUE', amount: totalRevenue, children: revenueChildren },
      { label: 'GROSS PROFIT', amount: totalRevenue },
      { label: 'OPERATING EXPENSES', amount: totalExpenses, children: expenseChildren },
      { label: 'NET INCOME', amount: netIncome },
    ],
    totals: { revenue: totalRevenue, expenses: totalExpenses, net_income: netIncome },
    metadata: {
      uncategorized_count: uncategorized.length,
      uncategorized_amount: uncategorized.reduce(
        (s, e) => s + Number(e.debit) - Number(e.credit),
        0
      ),
      uncategorized_entries: uncategorized.map(e => ({
        id: e.id,
        description: e.description,
        entry_date: e.entry_date,
        amount: Number(e.debit) || Number(e.credit),
        account_name: e.account?.name ?? 'Unknown',
      })),
    },
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/lib/statements/__tests__/pnl.test.ts --reporter=verbose
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/statements/pnl.ts src/lib/statements/__tests__/pnl.test.ts
git commit -m "feat: P&L computation"
```

---

## Task 4: Balance Sheet computation

**Files:**
- Create: `src/lib/statements/balance-sheet.ts`
- Create: `src/lib/statements/__tests__/balance-sheet.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/statements/__tests__/balance-sheet.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/db/repositories/ledger-repository', () => ({
  LedgerRepository: { list: vi.fn() },
}))

import { LedgerRepository } from '@/lib/db/repositories/ledger-repository'
import { computeBalanceSheet } from '../../../lib/statements/balance-sheet'

const mockEntries = [
  {
    id: 'e1', account_id: 'a1', debit: 10000, credit: 0, category: 'cash',
    entry_date: '2026-01-10', description: 'Cash deposit', source_doc_id: null,
    account: { id: 'a1', code: '1000', name: 'Cash', type: 'asset' },
  },
  {
    id: 'e2', account_id: 'a2', debit: 0, credit: 4000, category: 'accounts_payable',
    entry_date: '2026-01-15', description: 'Vendor invoice', source_doc_id: 'doc2',
    account: { id: 'a2', code: '2000', name: 'Accounts Payable', type: 'liability' },
  },
  {
    id: 'e3', account_id: 'a3', debit: 0, credit: 6000, category: 'equity',
    entry_date: '2026-01-01', description: 'Owner capital', source_doc_id: null,
    account: { id: 'a3', code: '3000', name: 'Owner Equity', type: 'equity' },
  },
]

describe('computeBalanceSheet', () => {
  beforeEach(() => {
    ;(LedgerRepository.list as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: mockEntries, total: 3, page: 1, per_page: 10000, has_more: false,
    })
  })

  it('computes correct asset, liability and equity totals', async () => {
    const result = await computeBalanceSheet('org-1', '2026-01-01', '2026-01-31')
    expect(result.totals.assets).toBe(10000)
    expect(result.totals.liabilities).toBe(4000)
    expect(result.totals.equity).toBe(6000)
  })

  it('is_balanced is true when assets = liabilities + equity', async () => {
    const result = await computeBalanceSheet('org-1', '2026-01-01', '2026-01-31')
    expect(result.metadata.is_balanced).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/statements/__tests__/balance-sheet.test.ts --reporter=verbose
```

Expected: FAIL — `Cannot find module '../../../lib/statements/balance-sheet'`

- [ ] **Step 3: Implement computeBalanceSheet**

Create `src/lib/statements/balance-sheet.ts`:

```ts
import { LedgerRepository } from '@/lib/db/repositories/ledger-repository'
import type { StatementData, StatementSection, LedgerEntry, ChartOfAccount } from '@/types'

interface AccountGroup {
  account: ChartOfAccount
  entries: LedgerEntry[]
}

function buildSection(
  label: string,
  groups: AccountGroup[],
  balanceType: 'debit' | 'credit'
): StatementSection {
  const children: StatementSection[] = groups.map(({ account, entries }) => {
    const entryChildren: StatementSection[] = entries.map(e => ({
      label: e.description ?? `Entry ${e.id.slice(0, 8)}`,
      amount:
        balanceType === 'debit'
          ? Number(e.debit) - Number(e.credit)
          : Number(e.credit) - Number(e.debit),
      entry_id: e.id,
      source_doc_id: e.source_doc_id,
      entry_date: e.entry_date,
    }))
    return {
      label: account.name,
      code: account.code,
      amount: entryChildren.reduce((s, c) => s + c.amount, 0),
      children: entryChildren,
    }
  })
  return {
    label,
    amount: children.reduce((s, c) => s + c.amount, 0),
    children,
  }
}

export async function computeBalanceSheet(
  orgId: string,
  from: string,
  to: string
): Promise<StatementData> {
  const { items: entries } = await LedgerRepository.list(
    orgId,
    { date_from: from, date_to: to },
    { per_page: 10000 }
  )

  const byAccount = new Map<string, AccountGroup>()
  const uncategorized: LedgerEntry[] = []

  for (const entry of entries) {
    if (!entry.account) continue
    if (!byAccount.has(entry.account_id)) {
      byAccount.set(entry.account_id, { account: entry.account, entries: [] })
    }
    byAccount.get(entry.account_id)!.entries.push(entry)
    if (entry.category === null) uncategorized.push(entry)
  }

  const groups = [...byAccount.values()]

  const assetSection = buildSection('ASSETS', groups.filter(g => g.account.type === 'asset'), 'debit')
  const liabilitySection = buildSection('LIABILITIES', groups.filter(g => g.account.type === 'liability'), 'credit')
  const equitySection = buildSection('EQUITY', groups.filter(g => g.account.type === 'equity'), 'credit')

  const totalAssets = assetSection.amount
  const totalLiabilities = liabilitySection.amount
  const totalEquity = equitySection.amount
  const isBalanced = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01

  return {
    sections: [
      assetSection,
      liabilitySection,
      equitySection,
      { label: 'TOTAL LIABILITIES & EQUITY', amount: totalLiabilities + totalEquity },
    ],
    totals: { assets: totalAssets, liabilities: totalLiabilities, equity: totalEquity },
    metadata: {
      is_balanced: isBalanced,
      imbalance_amount: totalAssets - (totalLiabilities + totalEquity),
      uncategorized_count: uncategorized.length,
      uncategorized_entries: uncategorized.map(e => ({
        id: e.id,
        description: e.description,
        entry_date: e.entry_date,
        amount: Number(e.debit) || Number(e.credit),
        account_name: e.account?.name ?? 'Unknown',
      })),
    },
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/lib/statements/__tests__/balance-sheet.test.ts --reporter=verbose
```

Expected: all 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/statements/balance-sheet.ts src/lib/statements/__tests__/balance-sheet.test.ts
git commit -m "feat: Balance Sheet computation"
```

---

## Task 5: Cash Flow computation

**Files:**
- Create: `src/lib/statements/cash-flow.ts`
- Create: `src/lib/statements/__tests__/cash-flow.test.ts`

The Cash Flow statement uses a simplified approach for MVP: net change in each account type group.
- Operating: revenue and expense accounts (net income proxy)
- Investing: asset account changes
- Financing: liability and equity account changes

- [ ] **Step 1: Write the failing test**

Create `src/lib/statements/__tests__/cash-flow.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/repositories/ledger-repository', () => ({
  LedgerRepository: { list: vi.fn() },
}))

import { LedgerRepository } from '@/lib/db/repositories/ledger-repository'
import { computeCashFlow } from '../../../lib/statements/cash-flow'

const mockEntries = [
  {
    id: 'e1', account_id: 'a1', debit: 0, credit: 8000, category: 'consulting',
    entry_date: '2026-01-10', description: 'Revenue', source_doc_id: 'doc1',
    account: { id: 'a1', code: '4000', name: 'Service Revenue', type: 'revenue' },
  },
  {
    id: 'e2', account_id: 'a2', debit: 3000, credit: 0, category: 'payroll',
    entry_date: '2026-01-20', description: 'Payroll', source_doc_id: null,
    account: { id: 'a2', code: '6000', name: 'Payroll Expense', type: 'expense' },
  },
  {
    id: 'e3', account_id: 'a3', debit: 0, credit: 5000, category: 'loan',
    entry_date: '2026-01-05', description: 'Loan proceeds', source_doc_id: null,
    account: { id: 'a3', code: '2100', name: 'Loan Payable', type: 'liability' },
  },
]

describe('computeCashFlow', () => {
  beforeEach(() => {
    ;(LedgerRepository.list as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: mockEntries, total: 3, page: 1, per_page: 10000, has_more: false,
    })
  })

  it('computes operating, investing, financing and net cash flow', async () => {
    const result = await computeCashFlow('org-1', '2026-01-01', '2026-01-31')
    // Operating = revenue (8000 credit) - expense (3000 debit) = 5000
    expect(result.totals.operating).toBe(5000)
    // Financing = liability credit = 5000
    expect(result.totals.financing).toBe(5000)
    // Net = operating + investing + financing
    expect(result.totals.net_cash_flow).toBe(result.totals.operating + result.totals.investing + result.totals.financing)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/statements/__tests__/cash-flow.test.ts --reporter=verbose
```

Expected: FAIL — `Cannot find module '../../../lib/statements/cash-flow'`

- [ ] **Step 3: Implement computeCashFlow**

Create `src/lib/statements/cash-flow.ts`:

```ts
import { LedgerRepository } from '@/lib/db/repositories/ledger-repository'
import type { StatementData, StatementSection, LedgerEntry, ChartOfAccount } from '@/types'

interface AccountGroup {
  account: ChartOfAccount
  entries: LedgerEntry[]
}

function netAmount(entries: LedgerEntry[]): number {
  return entries.reduce((s, e) => s + Number(e.credit) - Number(e.debit), 0)
}

function buildSection(label: string, groups: AccountGroup[]): StatementSection {
  const children: StatementSection[] = groups.map(({ account, entries }) => {
    const entryChildren: StatementSection[] = entries.map(e => ({
      label: e.description ?? `Entry ${e.id.slice(0, 8)}`,
      amount: Number(e.credit) - Number(e.debit),
      entry_id: e.id,
      source_doc_id: e.source_doc_id,
      entry_date: e.entry_date,
    }))
    return {
      label: account.name,
      code: account.code,
      amount: entryChildren.reduce((s, c) => s + c.amount, 0),
      children: entryChildren,
    }
  })
  return { label, amount: children.reduce((s, c) => s + c.amount, 0), children }
}

export async function computeCashFlow(
  orgId: string,
  from: string,
  to: string
): Promise<StatementData> {
  const { items: entries } = await LedgerRepository.list(
    orgId,
    { date_from: from, date_to: to },
    { per_page: 10000 }
  )

  const byAccount = new Map<string, AccountGroup>()
  const uncategorized: LedgerEntry[] = []

  for (const entry of entries) {
    if (!entry.account) continue
    if (!byAccount.has(entry.account_id)) {
      byAccount.set(entry.account_id, { account: entry.account, entries: [] })
    }
    byAccount.get(entry.account_id)!.entries.push(entry)
    if (entry.category === null) uncategorized.push(entry)
  }

  const groups = [...byAccount.values()]

  const operatingGroups = groups.filter(g => g.account.type === 'revenue' || g.account.type === 'expense')
  const investingGroups = groups.filter(g => g.account.type === 'asset')
  const financingGroups = groups.filter(g => g.account.type === 'liability' || g.account.type === 'equity')

  const operatingSection = buildSection('OPERATING ACTIVITIES', operatingGroups)
  const investingSection = buildSection('INVESTING ACTIVITIES', investingGroups)
  const financingSection = buildSection('FINANCING ACTIVITIES', financingGroups)

  const netCashFlow = operatingSection.amount + investingSection.amount + financingSection.amount

  return {
    sections: [
      operatingSection,
      investingSection,
      financingSection,
      { label: 'NET CASH FLOW', amount: netCashFlow },
    ],
    totals: {
      operating: operatingSection.amount,
      investing: investingSection.amount,
      financing: financingSection.amount,
      net_cash_flow: netCashFlow,
    },
    metadata: {
      uncategorized_count: uncategorized.length,
      uncategorized_entries: uncategorized.map(e => ({
        id: e.id,
        description: e.description,
        entry_date: e.entry_date,
        amount: Number(e.debit) || Number(e.credit),
        account_name: e.account?.name ?? 'Unknown',
      })),
    },
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/lib/statements/__tests__/cash-flow.test.ts --reporter=verbose
```

Expected: all 1 test PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/statements/cash-flow.ts src/lib/statements/__tests__/cash-flow.test.ts
git commit -m "feat: Cash Flow computation"
```

---

## Task 6: Export engine (PDF, XLSX, CSV)

**Files:**
- Create: `src/lib/statements/export.ts`

No tests for export — these depend on binary file output and are better verified manually.

- [ ] **Step 1: Create export.ts**

Create `src/lib/statements/export.ts`:

```ts
import type { StatementData, StatementSection, StatementType } from '@/types'

// ── CSV ───────────────────────────────────────────────────────

function flattenSections(sections: StatementSection[], depth = 0): string[] {
  const rows: string[] = []
  for (const s of sections) {
    const indent = '  '.repeat(depth)
    const label = `"${indent}${s.label.replace(/"/g, '""')}"`
    const amount = s.amount.toFixed(2)
    rows.push(`${label},${amount}`)
    if (s.children?.length) {
      rows.push(...flattenSections(s.children, depth + 1))
    }
  }
  return rows
}

export function toCSV(data: StatementData, _type: StatementType): Buffer {
  const lines = ['Label,Amount', ...flattenSections(data.sections)]
  return Buffer.from(lines.join('\n'), 'utf-8')
}

// ── XLSX ──────────────────────────────────────────────────────

export async function toXLSX(data: StatementData, _type: StatementType): Promise<Buffer> {
  const { utils, write } = await import('xlsx')

  const rows: (string | number)[][] = [['Label', 'Amount']]

  function addRows(sections: StatementSection[], depth = 0) {
    for (const s of sections) {
      rows.push(['  '.repeat(depth) + s.label, s.amount])
      if (s.children?.length) addRows(s.children, depth + 1)
    }
  }

  addRows(data.sections)

  const ws = utils.aoa_to_sheet(rows)
  const wb = utils.book_new()
  utils.book_append_sheet(wb, ws, 'Statement')

  return Buffer.from(write(wb, { type: 'buffer', bookType: 'xlsx' }))
}

// ── PDF ───────────────────────────────────────────────────────

export async function toPDF(data: StatementData, type: StatementType): Promise<Buffer> {
  // Dynamic import keeps @react-pdf/renderer out of the client bundle
  const { Document, Page, Text, View, StyleSheet, renderToBuffer } =
    await import('@react-pdf/renderer')
  const { createElement: h } = await import('react')

  const typeLabel: Record<StatementType, string> = {
    pnl: 'Profit & Loss',
    balance_sheet: 'Balance Sheet',
    cash_flow: 'Statement of Cash Flows',
  }

  const styles = StyleSheet.create({
    page: { fontFamily: 'Helvetica', padding: 48, fontSize: 10, color: '#1a1a1a' },
    title: { fontSize: 18, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
    subtitle: { fontSize: 10, color: '#666', marginBottom: 24 },
    sectionHeader: { fontFamily: 'Helvetica-Bold', fontSize: 11, marginTop: 16, marginBottom: 4, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#e5e5e5' },
    rowIndent1: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 1, paddingLeft: 12 },
    rowIndent2: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 1, paddingLeft: 24, color: '#666' },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, marginTop: 8, borderTopWidth: 1, borderTopColor: '#1a1a1a', fontFamily: 'Helvetica-Bold' },
    label: { flex: 1 },
    amount: { textAlign: 'right', fontFamily: 'Helvetica', minWidth: 80 },
    amountBold: { textAlign: 'right', fontFamily: 'Helvetica-Bold', minWidth: 80 },
  })

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

  function renderSection(section: StatementSection, depth = 0) {
    const isTotal = section.label.startsWith('NET') || section.label.startsWith('TOTAL') || section.label.startsWith('GROSS')
    const rowStyle = isTotal ? styles.totalRow : depth === 0 ? styles.sectionHeader : depth === 1 ? styles.rowIndent1 : styles.rowIndent2
    const amtStyle = isTotal ? styles.amountBold : styles.amount

    return h(View, { key: section.label },
      h(View, { style: rowStyle },
        h(Text, { style: styles.label }, section.label),
        h(Text, { style: amtStyle }, fmt(section.amount))
      ),
      ...(section.children?.map(c => renderSection(c, depth + 1)) ?? [])
    )
  }

  const doc = h(Document, null,
    h(Page, { size: 'A4', style: styles.page },
      h(Text, { style: styles.title }, typeLabel[type]),
      h(Text, { style: styles.subtitle }, 'Generated by Humaris'),
      ...data.sections.map(s => renderSection(s))
    )
  )

  return renderToBuffer(doc)
}

// ── Dispatcher ────────────────────────────────────────────────

export async function exportStatement(
  data: StatementData,
  type: StatementType,
  format: 'pdf' | 'xlsx' | 'csv'
): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
  const typeLabel: Record<StatementType, string> = {
    pnl: 'PnL',
    balance_sheet: 'BalanceSheet',
    cash_flow: 'CashFlow',
  }
  const base = typeLabel[type]

  if (format === 'csv') {
    return {
      buffer: toCSV(data, type),
      contentType: 'text/csv',
      filename: `${base}.csv`,
    }
  }
  if (format === 'xlsx') {
    return {
      buffer: await toXLSX(data, type),
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `${base}.xlsx`,
    }
  }
  return {
    buffer: await toPDF(data, type),
    contentType: 'application/pdf',
    filename: `${base}.pdf`,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/statements/export.ts
git commit -m "feat: statement export engine (PDF, XLSX, CSV)"
```

---

## Task 7: API routes

**Files:**
- Create: `src/app/api/statements/[type]/route.ts`
- Create: `src/app/api/statements/[type]/refresh/route.ts`
- Create: `src/app/api/statements/export/route.ts`

- [ ] **Step 1: Create GET statement route**

Create `src/app/api/statements/[type]/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { permissions } from '@/lib/rbac/permissions'
import { StatementRepository } from '@/lib/db/repositories/statement-repository'
import { computePnL } from '@/lib/statements/pnl'
import { computeBalanceSheet } from '@/lib/statements/balance-sheet'
import { computeCashFlow } from '@/lib/statements/cash-flow'
import type { StatementType } from '@/types'

export const runtime = 'nodejs'

const VALID_TYPES: StatementType[] = ['pnl', 'balance_sheet', 'cash_flow']

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const session = await requireSession()
    if (!permissions.statements.view(session.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { type } = await params
    if (!VALID_TYPES.includes(type as StatementType)) {
      return NextResponse.json({ error: 'Invalid statement type' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    if (!from || !to) {
      return NextResponse.json({ error: 'from and to query params are required' }, { status: 400 })
    }

    const statementType = type as StatementType
    const orgId = session.org.id

    // Check cache
    const cached = await StatementRepository.getCached(orgId, statementType, from, to)
    if (cached) {
      return NextResponse.json({ statement: cached, cached: true })
    }

    // Compute
    const computeFn = statementType === 'pnl'
      ? computePnL
      : statementType === 'balance_sheet'
        ? computeBalanceSheet
        : computeCashFlow

    const data = await computeFn(orgId, from, to)

    const statement = await StatementRepository.saveCache(
      orgId, statementType, from, to, data, session.id
    )

    return NextResponse.json({ statement, cached: false })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate statement' },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: Create POST refresh route**

Create `src/app/api/statements/[type]/refresh/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { permissions } from '@/lib/rbac/permissions'
import { StatementRepository } from '@/lib/db/repositories/statement-repository'
import { computePnL } from '@/lib/statements/pnl'
import { computeBalanceSheet } from '@/lib/statements/balance-sheet'
import { computeCashFlow } from '@/lib/statements/cash-flow'
import type { StatementType } from '@/types'

export const runtime = 'nodejs'

const VALID_TYPES: StatementType[] = ['pnl', 'balance_sheet', 'cash_flow']

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const session = await requireSession()
    if (!permissions.statements.generate(session.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { type } = await params
    if (!VALID_TYPES.includes(type as StatementType)) {
      return NextResponse.json({ error: 'Invalid statement type' }, { status: 400 })
    }

    const body = await request.json()
    const { from, to } = body

    if (!from || !to) {
      return NextResponse.json({ error: 'from and to are required in request body' }, { status: 400 })
    }

    const statementType = type as StatementType
    const orgId = session.org.id

    const computeFn = statementType === 'pnl'
      ? computePnL
      : statementType === 'balance_sheet'
        ? computeBalanceSheet
        : computeCashFlow

    const data = await computeFn(orgId, from, to)
    const statement = await StatementRepository.saveCache(
      orgId, statementType, from, to, data, session.id
    )

    return NextResponse.json({ statement })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to refresh statement' },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 3: Create GET export route**

Create `src/app/api/statements/export/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { permissions } from '@/lib/rbac/permissions'
import { StatementRepository } from '@/lib/db/repositories/statement-repository'
import { computePnL } from '@/lib/statements/pnl'
import { computeBalanceSheet } from '@/lib/statements/balance-sheet'
import { computeCashFlow } from '@/lib/statements/cash-flow'
import { exportStatement } from '@/lib/statements/export'
import type { StatementType } from '@/types'

export const runtime = 'nodejs'

const VALID_TYPES: StatementType[] = ['pnl', 'balance_sheet', 'cash_flow']
const VALID_FORMATS = ['pdf', 'xlsx', 'csv'] as const

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession()
    if (!permissions.statements.export(session.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const format = searchParams.get('format')

    if (!type || !VALID_TYPES.includes(type as StatementType)) {
      return NextResponse.json({ error: 'Invalid statement type' }, { status: 400 })
    }
    if (!from || !to) {
      return NextResponse.json({ error: 'from and to are required' }, { status: 400 })
    }
    if (!format || !VALID_FORMATS.includes(format as typeof VALID_FORMATS[number])) {
      return NextResponse.json({ error: 'format must be pdf, xlsx, or csv' }, { status: 400 })
    }

    const statementType = type as StatementType
    const orgId = session.org.id

    // Use cache if available, otherwise compute
    let data = (await StatementRepository.getCached(orgId, statementType, from, to))?.data

    if (!data) {
      const computeFn = statementType === 'pnl'
        ? computePnL
        : statementType === 'balance_sheet'
          ? computeBalanceSheet
          : computeCashFlow
      data = await computeFn(orgId, from, to)
    }

    const { buffer, contentType, filename } = await exportStatement(
      data,
      statementType,
      format as typeof VALID_FORMATS[number]
    )

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Export failed' },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/statements/
git commit -m "feat: statement API routes (GET, refresh, export)"
```

---

## Task 8: Cache invalidation in ledger routes

**Files:**
- Modify: `src/app/api/ledger/route.ts`
- Modify: `src/app/api/ledger/[id]/route.ts`

Whenever a ledger entry is created, updated, or deleted, all cached statements for the org must be cleared.

- [ ] **Step 1: Add cache bust to POST /api/ledger**

In `src/app/api/ledger/route.ts`, add the import at the top:

```ts
import { StatementRepository } from '@/lib/db/repositories/statement-repository'
```

Then in the `POST` handler, after `const entry = await LedgerRepository.create(...)` and before the `return`, add:

```ts
await StatementRepository.clearCacheForOrg(session.org.id)
```

The final POST handler return block should look like:

```ts
    const entry = await LedgerRepository.create({
      org_id: session.org.id,
      account_id,
      entry_date,
      description: description ?? null,
      debit: debitAmount,
      credit: creditAmount,
      category: category ?? null,
      is_manual: true,
      created_by: session.id,
    })

    await StatementRepository.clearCacheForOrg(session.org.id)

    return NextResponse.json({ entry }, { status: 201 })
```

- [ ] **Step 2: Add cache bust to PATCH and DELETE /api/ledger/[id]**

In `src/app/api/ledger/[id]/route.ts`, add the import at the top:

```ts
import { StatementRepository } from '@/lib/db/repositories/statement-repository'
```

In the `PATCH` handler, after `const entry = await LedgerRepository.update(...)` and before the return:

```ts
    const entry = await LedgerRepository.update(id, session.org.id, updates)
    await StatementRepository.clearCacheForOrg(session.org.id)
    return NextResponse.json({ entry })
```

In the `DELETE` handler, after `await LedgerRepository.delete(...)` and before the return:

```ts
    await LedgerRepository.delete(id, session.org.id)
    await StatementRepository.clearCacheForOrg(session.org.id)
    return NextResponse.json({ success: true })
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/ledger/route.ts src/app/api/ledger/[id]/route.ts
git commit -m "feat: bust statement cache on ledger mutations"
```

---

## Task 9: TanStack Query hooks

**Files:**
- Create: `src/hooks/use-statements.ts`

- [ ] **Step 1: Create use-statements.ts**

Create `src/hooks/use-statements.ts`:

```ts
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { FinancialStatement, StatementType } from '@/types'

export interface StatementPeriod {
  from: string
  to: string
}

function getToday(): string {
  return new Date().toISOString().split('T')[0]
}

function getStartOf(unit: 'month' | 'quarter' | 'year'): string {
  const now = new Date()
  if (unit === 'month') return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  if (unit === 'quarter') {
    const q = Math.floor(now.getMonth() / 3)
    return new Date(now.getFullYear(), q * 3, 1).toISOString().split('T')[0]
  }
  return new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0]
}

export function getMTD(): StatementPeriod { return { from: getStartOf('month'), to: getToday() } }
export function getQTD(): StatementPeriod { return { from: getStartOf('quarter'), to: getToday() } }
export function getYTD(): StatementPeriod { return { from: getStartOf('year'), to: getToday() } }

export function useStatement(type: StatementType, period: StatementPeriod | null) {
  const params = period
    ? new URLSearchParams({ from: period.from, to: period.to }).toString()
    : ''

  return useQuery<{ statement: FinancialStatement; cached: boolean }>({
    queryKey: ['statements', type, period],
    queryFn: () =>
      fetch(`/api/statements/${type}?${params}`).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error ?? 'Failed to load statement')
        return r.json()
      }),
    enabled: !!period,
  })
}

export function useRefreshStatement(type: StatementType) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (period: StatementPeriod) => {
      const r = await fetch(`/api/statements/${type}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(period),
      })
      if (!r.ok) throw new Error((await r.json()).error ?? 'Refresh failed')
      return r.json()
    },
    onSuccess: (_data, period) => {
      qc.invalidateQueries({ queryKey: ['statements', type, period] })
    },
  })
}

export function downloadStatement(
  type: StatementType,
  period: StatementPeriod,
  format: 'pdf' | 'xlsx' | 'csv'
): void {
  const params = new URLSearchParams({ type, from: period.from, to: period.to, format })
  window.location.href = `/api/statements/export?${params}`
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/use-statements.ts
git commit -m "feat: useStatement and useRefreshStatement hooks"
```

---

## Task 10: PeriodSelector component

**Files:**
- Create: `src/components/statements/period-selector.tsx`

- [ ] **Step 1: Create period-selector.tsx**

Create `src/components/statements/period-selector.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getMTD, getQTD, getYTD, type StatementPeriod } from '@/hooks/use-statements'

type Preset = 'MTD' | 'QTD' | 'YTD' | 'custom'

interface PeriodSelectorProps {
  value: StatementPeriod | null
  onChange: (period: StatementPeriod) => void
}

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  const [preset, setPreset] = useState<Preset>('MTD')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  function selectPreset(p: Preset) {
    setPreset(p)
    if (p === 'MTD') onChange(getMTD())
    else if (p === 'QTD') onChange(getQTD())
    else if (p === 'YTD') onChange(getYTD())
  }

  function applyCustom() {
    if (customFrom && customTo) onChange({ from: customFrom, to: customTo })
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-1">
        {(['MTD', 'QTD', 'YTD'] as const).map(p => (
          <button
            key={p}
            onClick={() => selectPreset(p)}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-medium transition-all',
              preset === p
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {p}
          </button>
        ))}
        <button
          onClick={() => setPreset('custom')}
          className={cn(
            'px-3 py-1.5 rounded-md text-sm font-medium transition-all',
            preset === 'custom'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          )}
        >
          Custom
        </button>
      </div>

      {preset === 'custom' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customFrom}
            onChange={e => setCustomFrom(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1"
          />
          <span className="text-gray-400 text-sm">–</span>
          <input
            type="date"
            value={customTo}
            onChange={e => setCustomTo(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1"
          />
          <Button size="sm" variant="outline" onClick={applyCustom} disabled={!customFrom || !customTo}>
            Apply
          </Button>
        </div>
      )}

      {value && (
        <span className="text-xs text-gray-400">
          {new Date(value.from).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          {' – '}
          {new Date(value.to).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/statements/period-selector.tsx
git commit -m "feat: PeriodSelector component (MTD/QTD/YTD + custom range)"
```

---

## Task 11: StatementTable component

**Files:**
- Create: `src/components/statements/statement-table.tsx`

This is the accordion table. Clicking a row expands it to show its children inline. Leaf rows (entries) show a link to source documents. Uncategorized entries are shown in an amber section.

- [ ] **Step 1: Create statement-table.tsx**

Create `src/components/statements/statement-table.tsx`:

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { StatementData, StatementSection } from '@/types'

interface StatementTableProps {
  data: StatementData
  generatedAt: string
}

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export function StatementTable({ data, generatedAt }: StatementTableProps) {
  const uncategorized = (data.metadata.uncategorized_entries ?? []) as {
    id: string
    description: string | null
    entry_date: string
    amount: number
    account_name: string
  }[]

  return (
    <div className="space-y-1">
      {data.sections.map(section => (
        <Section key={section.label} section={section} depth={0} />
      ))}

      {uncategorized.length > 0 && (
        <div className="mt-6 border border-amber-200 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 bg-amber-50">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="text-sm font-semibold text-amber-800">
              Uncategorized ({uncategorized.length})
            </span>
            <span className="text-sm text-amber-600 ml-auto">
              {USD.format(uncategorized.reduce((s, e) => s + e.amount, 0))}
            </span>
          </div>
          <div className="divide-y divide-amber-100">
            {uncategorized.map(e => (
              <div key={e.id} className="flex items-center justify-between px-5 py-2.5 bg-white hover:bg-amber-50/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 truncate">
                    {e.description ?? `Entry ${e.id.slice(0, 8)}`}
                  </p>
                  <p className="text-xs text-gray-400">
                    {e.account_name} · {e.entry_date}
                  </p>
                </div>
                <div className="flex items-center gap-4 shrink-0 ml-4">
                  <span className="text-sm tabular-nums text-gray-700">
                    {USD.format(e.amount)}
                  </span>
                  <Link
                    href={`/ledger?entry=${e.id}`}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700 underline-offset-2 hover:underline"
                  >
                    Categorize
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 pt-4 text-right">
        Last generated {new Date(generatedAt).toLocaleString()}
      </p>
    </div>
  )
}

function Section({ section, depth }: { section: StatementSection; depth: number }) {
  const [open, setOpen] = useState(false)
  const hasChildren = (section.children?.length ?? 0) > 0
  const isEntry = !!section.entry_id
  const isSummaryRow = depth === 0 && !hasChildren

  const isTotal =
    section.label.startsWith('NET') ||
    section.label.startsWith('TOTAL') ||
    section.label.startsWith('GROSS')

  if (isTotal) {
    return (
      <div className="flex items-center justify-between px-5 py-3 border-t-2 border-gray-900 mt-2">
        <span className="text-sm font-bold text-gray-900 uppercase tracking-wide">
          {section.label}
        </span>
        <span className={cn('text-sm font-bold tabular-nums', section.amount < 0 ? 'text-red-600' : 'text-gray-900')}>
          {USD.format(section.amount)}
        </span>
      </div>
    )
  }

  if (depth === 0) {
    // Section header
    return (
      <div className="pt-4">
        <div
          onClick={() => hasChildren && setOpen(o => !o)}
          className={cn(
            'flex items-center justify-between px-5 py-2',
            hasChildren && 'cursor-pointer group'
          )}
        >
          <div className="flex items-center gap-2">
            {hasChildren && (
              <ChevronRight
                className={cn('w-3.5 h-3.5 text-gray-400 transition-transform shrink-0', open && 'rotate-90')}
              />
            )}
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
              {section.label}
            </span>
          </div>
          <span className="text-sm font-semibold tabular-nums text-gray-700">
            {USD.format(section.amount)}
          </span>
        </div>
        {open && section.children && (
          <div className="pb-2">
            {section.children.map(c => (
              <Section key={c.label + (c.entry_id ?? '')} section={c} depth={depth + 1} />
            ))}
          </div>
        )}
        {!hasChildren && (
          <div className="h-px bg-gray-100 mx-5 mt-1" />
        )}
      </div>
    )
  }

  if (isEntry) {
    // Leaf — individual ledger entry
    return (
      <div className="flex items-center justify-between px-5 py-2 hover:bg-gray-50 transition-colors" style={{ paddingLeft: `${depth * 20 + 20}px` }}>
        <div className="flex-1 min-w-0">
          <span className="text-sm text-gray-600 truncate block">{section.label}</span>
          {section.entry_date && (
            <span className="text-xs text-gray-400">{section.entry_date}</span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-4">
          <span className="text-sm tabular-nums text-gray-600">{USD.format(section.amount)}</span>
          {section.source_doc_id && (
            <Link
              href={`/documents/${section.source_doc_id}`}
              className="text-xs text-blue-500 hover:text-blue-600"
            >
              View doc
            </Link>
          )}
        </div>
      </div>
    )
  }

  // Account row (depth 1)
  return (
    <div>
      <div
        onClick={() => hasChildren && setOpen(o => !o)}
        className={cn(
          'flex items-center justify-between px-5 py-2.5 hover:bg-gray-50 transition-colors',
          hasChildren && 'cursor-pointer'
        )}
        style={{ paddingLeft: `${depth * 20 + 20}px` }}
      >
        <div className="flex items-center gap-2">
          {hasChildren && (
            <ChevronRight
              className={cn('w-3 h-3 text-gray-400 transition-transform shrink-0', open && 'rotate-90')}
            />
          )}
          <span className="text-sm text-gray-700">{section.label}</span>
          {section.code && <span className="text-xs text-gray-400">{section.code}</span>}
        </div>
        <span className="text-sm tabular-nums text-gray-700">{USD.format(section.amount)}</span>
      </div>
      {open && section.children && section.children.map(c => (
        <Section key={c.label + (c.entry_id ?? '')} section={c} depth={depth + 1} />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/statements/statement-table.tsx
git commit -m "feat: StatementTable accordion component"
```

---

## Task 12: ExportButton component

**Files:**
- Create: `src/components/statements/export-button.tsx`

- [ ] **Step 1: Create export-button.tsx**

Create `src/components/statements/export-button.tsx`:

```tsx
'use client'

import { Download, FileText, Table, FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { downloadStatement } from '@/hooks/use-statements'
import type { StatementType } from '@/types'
import type { StatementPeriod } from '@/hooks/use-statements'

interface ExportButtonProps {
  type: StatementType
  period: StatementPeriod
  disabled?: boolean
}

export function ExportButton({ type, period, disabled }: ExportButtonProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <Download className="w-4 h-4 mr-1.5" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onClick={() => downloadStatement(type, period, 'pdf')}>
          <FileText className="w-4 h-4 mr-2 text-red-500" />
          PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => downloadStatement(type, period, 'xlsx')}>
          <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" />
          Excel (XLSX)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => downloadStatement(type, period, 'csv')}>
          <Table className="w-4 h-4 mr-2 text-blue-500" />
          CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/statements/export-button.tsx
git commit -m "feat: ExportButton dropdown component"
```

---

## Task 13: Statements page

**Files:**
- Create: `src/app/(app)/statements/page.tsx`

- [ ] **Step 1: Create statements page**

Create `src/app/(app)/statements/page.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { RefreshCw, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PeriodSelector } from '@/components/statements/period-selector'
import { StatementTable } from '@/components/statements/statement-table'
import { ExportButton } from '@/components/statements/export-button'
import {
  useStatement,
  useRefreshStatement,
  getMTD,
  type StatementPeriod,
} from '@/hooks/use-statements'
import type { StatementType } from '@/types'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const STATEMENT_TYPES: { value: StatementType; label: string }[] = [
  { value: 'pnl', label: 'Profit & Loss' },
  { value: 'balance_sheet', label: 'Balance Sheet' },
  { value: 'cash_flow', label: 'Cash Flow' },
]

export default function StatementsPage() {
  const [activeType, setActiveType] = useState<StatementType>('pnl')
  const [period, setPeriod] = useState<StatementPeriod>(getMTD())

  const { data, isLoading, error } = useStatement(activeType, period)
  const refresh = useRefreshStatement(activeType)

  const statement = data?.statement
  const isBalanced = statement?.data.metadata.is_balanced as boolean | undefined
  const showImbalanceWarning = activeType === 'balance_sheet' && isBalanced === false

  function handleRefresh() {
    refresh.mutate(period, {
      onSuccess: () => toast.success('Statement refreshed'),
      onError: (e) => toast.error(e instanceof Error ? e.message : 'Refresh failed'),
    })
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif' }}>
            Financial Statements
          </h1>
          <p className="text-gray-500 mt-1 text-sm">Auto-generated from your ledger</p>
        </div>
        {statement && (
          <ExportButton type={activeType} period={period} />
        )}
      </div>

      {/* Statement type tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {STATEMENT_TYPES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setActiveType(value)}
              className={cn(
                'pb-3 text-sm font-medium border-b-2 transition-colors',
                activeType === value
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Period selector + refresh */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <PeriodSelector value={period} onChange={setPeriod} />
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={refresh.isPending}
          className="text-gray-500 hover:text-gray-700"
        >
          <RefreshCw className={cn('w-3.5 h-3.5 mr-1.5', refresh.isPending && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Balance sheet imbalance warning */}
      {showImbalanceWarning && (
        <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Balance sheet doesn&apos;t balance</p>
            <p className="text-sm text-amber-600 mt-0.5">
              There may be uncategorized or incorrectly posted transactions.
              The data below is shown as-is.
            </p>
          </div>
        </div>
      )}

      {/* Content */}
      {isLoading && (
        <div className="space-y-3 animate-pulse">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-100 rounded-lg" />
          ))}
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center py-16 text-center">
          <div>
            <p className="text-sm font-medium text-gray-700">Failed to load statement</p>
            <p className="text-sm text-gray-400 mt-1">
              {error instanceof Error ? error.message : 'Unknown error'}
            </p>
          </div>
        </div>
      )}

      {!isLoading && !error && !statement && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-sm font-medium text-gray-700">No transactions found for this period</p>
          <p className="text-sm text-gray-400 mt-1">Add ledger entries to generate a statement</p>
          <a href="/ledger" className="mt-4 text-sm font-medium text-gray-900 underline underline-offset-2">
            Go to Ledger
          </a>
        </div>
      )}

      {!isLoading && statement && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <StatementTable
            data={statement.data}
            generatedAt={statement.generated_at}
          />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/(app)/statements/page.tsx
git commit -m "feat: statements page"
```

---

## Task 14: Add Statements to navigation

**Files:**
- Modify: `src/components/layout/app-shell.tsx`

- [ ] **Step 1: Add Statements nav item**

In `src/components/layout/app-shell.tsx`, find the `NAV_ITEMS` array:

```ts
const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/upload', label: 'Upload Files', icon: Upload },
  { href: '/documents', label: 'Documents', icon: FolderOpen },
  { href: '/extraction', label: 'Review Queue', icon: ClipboardCheck },
  { href: '/ledger', label: 'Ledger', icon: BookOpen },
  { href: '/templates', label: 'Templates', icon: FileText },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/settings', label: 'Settings', icon: Settings },
]
```

Replace with:

```ts
const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/upload', label: 'Upload Files', icon: Upload },
  { href: '/documents', label: 'Documents', icon: FolderOpen },
  { href: '/extraction', label: 'Review Queue', icon: ClipboardCheck },
  { href: '/ledger', label: 'Ledger', icon: BookBook },
  { href: '/statements', label: 'Statements', icon: BarChart3 },
  { href: '/templates', label: 'Templates', icon: FileText },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/settings', label: 'Settings', icon: Settings },
]
```

Also add `BarChart3` to the lucide-react import at the top of the file. The existing import is:

```ts
import {
  LayoutDashboard,
  Upload,
  FolderOpen,
  BookOpen,
  FileText,
  Search,
  Settings,
  LogOut,
  ChevronRight,
  ClipboardCheck,
} from 'lucide-react'
```

Replace with:

```ts
import {
  LayoutDashboard,
  Upload,
  FolderOpen,
  BookOpen,
  BarChart3,
  FileText,
  Search,
  Settings,
  LogOut,
  ChevronRight,
  ClipboardCheck,
} from 'lucide-react'
```

Note: The `BookBook` reference in NAV_ITEMS was a typo — keep `BookOpen` for Ledger. The final `NAV_ITEMS` should be:

```ts
const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/upload', label: 'Upload Files', icon: Upload },
  { href: '/documents', label: 'Documents', icon: FolderOpen },
  { href: '/extraction', label: 'Review Queue', icon: ClipboardCheck },
  { href: '/ledger', label: 'Ledger', icon: BookOpen },
  { href: '/statements', label: 'Statements', icon: BarChart3 },
  { href: '/templates', label: 'Templates', icon: FileText },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/settings', label: 'Settings', icon: Settings },
]
```

- [ ] **Step 2: Run the build to catch any TypeScript errors**

```bash
cd /Users/faris/Documents/Humaris && npm run build 2>&1 | tail -30
```

Expected: build completes with no TypeScript errors. If errors appear, fix them before committing.

- [ ] **Step 3: Run all tests**

```bash
npx vitest run --reporter=verbose
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/app-shell.tsx
git commit -m "feat: add Statements to navigation"
```

---

## Task 15: Sprint 5 final commit

- [ ] **Step 1: Verify the dev server starts cleanly**

```bash
npm run dev 2>&1 &
sleep 3
curl -s http://localhost:3000 | head -5
kill %1
```

Expected: HTML response with no crash errors.

- [ ] **Step 2: Final commit**

```bash
git add -A
git status
```

If `git status` shows only already-staged or clean files, run:

```bash
git commit -m "feat: Sprint 5 — Financial Statement Generator complete" --allow-empty
```

Otherwise stage any missed files and commit:

```bash
git commit -m "feat: Sprint 5 — Financial Statement Generator complete"
```
