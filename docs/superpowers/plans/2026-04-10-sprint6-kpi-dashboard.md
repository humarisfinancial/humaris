# KPI Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder `/dashboard` page with a live CFO-grade KPI dashboard — six metric cards with MoM and YoY comparison badges, a 12-month revenue trend area chart, and an expense breakdown donut chart, all computed from ledger data.

**Architecture:** A thin `/api/kpi` endpoint computes KPI metrics for the selected period and both comparison periods (MoM + YoY) in one response via three parallel `LedgerRepository.getAccountBalances()` calls. A separate `/api/kpi/trend` endpoint always returns trailing 12 monthly buckets for the area chart. No new DB tables — TanStack Query handles client-side caching.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase, TanStack Query v5, Recharts v3 (already installed), shadcn/ui, Tailwind CSS v4, Vitest

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/types/index.ts` | Add KPISnapshot, KPIResponse, KPITrendMonth, KPITrendResponse |
| Create | `src/lib/kpi/compute.ts` | Pure KPI computation from AccountBalance[]; prior-period helpers |
| Create | `src/lib/kpi/__tests__/compute.test.ts` | Unit tests — no mocking required (pure functions) |
| Create | `src/app/api/kpi/route.ts` | GET /api/kpi: metrics + comparisons + expense breakdown |
| Create | `src/app/api/kpi/trend/route.ts` | GET /api/kpi/trend: 12-month monthly series |
| Create | `src/hooks/use-kpi.ts` | TanStack Query hooks: useKPI, useKPITrend |
| Create | `src/components/dashboard/kpi-card.tsx` | Metric card with MoM/YoY badges |
| Create | `src/components/dashboard/revenue-trend-chart.tsx` | Recharts AreaChart (Revenue + Net Income, 12 months) |
| Create | `src/components/dashboard/expense-donut-chart.tsx` | Recharts PieChart donut (expense breakdown) |
| Modify | `src/app/(app)/dashboard/page.tsx` | Replace placeholder with live dashboard |

---

## Codebase Context

**`LedgerRepository.getAccountBalances(orgId, dateFrom?, dateTo?)`** — returns `AccountBalance[]`:
```ts
interface AccountBalance {
  account_id: string
  account_code: string   // e.g. '4000', '5000', '6000'
  account_name: string
  account_type: string   // 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
  total_debit: number
  total_credit: number
  balance: number        // = total_debit - total_credit
}
```

**Balance interpretation:**
- Revenue accounts: normal credit balance → revenue = `total_credit - total_debit`
- Expense accounts: normal debit balance → expense = `total_debit - total_credit`
- COGS accounts: expense accounts with code starting with `'5'` (e.g. `5000`–`5999`)

**Permissions:** `permissions.dashboard.view(role)` → all roles (`hasMinRole(role, 'viewer')`)

**Reusable components:** `<PeriodSelector>` from `src/components/statements/period-selector.tsx`, `getMTD` + `StatementPeriod` from `src/hooks/use-statements.ts`

---

## Task 1: KPI types + computation + tests

**Files:**
- Modify: `src/types/index.ts` (append after line 243)
- Create: `src/lib/kpi/compute.ts`
- Create: `src/lib/kpi/__tests__/compute.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/kpi/__tests__/compute.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeKPIs, getMomPrior, getYoyPrior } from '../../../lib/kpi/compute'
import type { AccountBalance } from '@/types'

const FIXTURES: AccountBalance[] = [
  // Revenue: $10,000 credit
  { account_id: 'a1', account_code: '4000', account_name: 'Service Revenue', account_type: 'revenue', total_debit: 0, total_credit: 10000, balance: -10000 },
  // COGS (5xxx): $3,000 debit
  { account_id: 'a2', account_code: '5000', account_name: 'Cost of Goods', account_type: 'expense', total_debit: 3000, total_credit: 0, balance: 3000 },
  // Operating expense (6xxx): $2,000 debit
  { account_id: 'a3', account_code: '6000', account_name: 'Rent', account_type: 'expense', total_debit: 2000, total_credit: 0, balance: 2000 },
  // Asset: $5,000 debit
  { account_id: 'a4', account_code: '1000', account_name: 'Cash', account_type: 'asset', total_debit: 5000, total_credit: 0, balance: 5000 },
  // Liability: $2,000 credit
  { account_id: 'a5', account_code: '2000', account_name: 'Loan Payable', account_type: 'liability', total_debit: 0, total_credit: 2000, balance: -2000 },
]

describe('computeKPIs', () => {
  it('computes revenue from credit-side revenue accounts', () => {
    expect(computeKPIs(FIXTURES).revenue).toBe(10000)
  })

  it('separates COGS (5xxx codes) for gross profit', () => {
    // Revenue $10,000 - COGS $3,000 = $7,000
    expect(computeKPIs(FIXTURES).grossProfit).toBe(7000)
  })

  it('computes net income as revenue minus all expenses', () => {
    // $10,000 - $3,000 - $2,000 = $5,000
    expect(computeKPIs(FIXTURES).netIncome).toBe(5000)
  })

  it('computes total expenses from all expense account debits', () => {
    expect(computeKPIs(FIXTURES).totalExpenses).toBe(5000)
  })

  it('computes gross margin as grossProfit / revenue × 100', () => {
    expect(computeKPIs(FIXTURES).grossMargin).toBeCloseTo(70.0)
  })

  it('computes net margin as netIncome / revenue × 100', () => {
    expect(computeKPIs(FIXTURES).netMargin).toBeCloseTo(50.0)
  })

  it('returns null margins when revenue is zero', () => {
    const result = computeKPIs([])
    expect(result.grossMargin).toBeNull()
    expect(result.netMargin).toBeNull()
  })

  it('returns all zeros on empty balances', () => {
    const result = computeKPIs([])
    expect(result.revenue).toBe(0)
    expect(result.netIncome).toBe(0)
    expect(result.totalExpenses).toBe(0)
  })
})

describe('getMomPrior', () => {
  it('shifts a 10-day period back by 10 days', () => {
    // Apr 1–10 (10 days) → prior = Mar 22–31
    expect(getMomPrior('2026-04-01', '2026-04-10')).toEqual({
      from: '2026-03-22',
      to: '2026-03-31',
    })
  })

  it('handles month boundary: Feb shifts to Jan', () => {
    // Feb 1–28 (28 days) → prior ends Jan 31, starts Jan 4
    expect(getMomPrior('2026-02-01', '2026-02-28')).toEqual({
      from: '2026-01-04',
      to: '2026-01-31',
    })
  })
})

describe('getYoyPrior', () => {
  it('shifts a date range back by one year', () => {
    expect(getYoyPrior('2026-04-01', '2026-04-10')).toEqual({
      from: '2025-04-01',
      to: '2025-04-10',
    })
  })

  it('shifts a year-start range back by one year', () => {
    expect(getYoyPrior('2026-01-01', '2026-01-31')).toEqual({
      from: '2025-01-01',
      to: '2025-01-31',
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/faris/Documents/Humaris && npx vitest run src/lib/kpi/__tests__/compute.test.ts --reporter=verbose 2>&1
```

Expected: FAIL — `Cannot find module '../../../lib/kpi/compute'`

- [ ] **Step 3: Add KPI types to src/types/index.ts**

Append to the end of `src/types/index.ts` (after the `PaginationParams` interface):

```ts
// ============================================================
// KPI Dashboard types
// ============================================================

export interface KPISnapshot {
  revenue: number
  grossProfit: number
  netIncome: number
  totalExpenses: number
  netCashFlow: number
  grossMargin: number | null  // null when revenue = 0
  netMargin: number | null    // null when revenue = 0
}

export interface KPIResponse {
  current: KPISnapshot
  mom: KPISnapshot
  yoy: KPISnapshot
  revenueGrowthRate: number | null  // null when mom.revenue = 0
  expenseBreakdown: { name: string; value: number }[]
  periodLabel: string
  generatedAt: string
}

export interface KPITrendMonth {
  month: string    // 'YYYY-MM'
  revenue: number
  netIncome: number
}

export interface KPITrendResponse {
  months: KPITrendMonth[]
}
```

- [ ] **Step 4: Create src/lib/kpi/compute.ts**

```ts
import type { AccountBalance, KPISnapshot } from '@/types'

export function computeKPIs(balances: AccountBalance[]): KPISnapshot {
  const revenueAccounts = balances.filter(b => b.account_type === 'revenue')
  const expenseAccounts = balances.filter(b => b.account_type === 'expense')
  const assetAccounts = balances.filter(b => b.account_type === 'asset')
  const liabilityEquityAccounts = balances.filter(
    b => b.account_type === 'liability' || b.account_type === 'equity'
  )

  // Revenue: credit is the normal balance side
  const revenue = revenueAccounts.reduce((s, b) => s + b.total_credit - b.total_debit, 0)

  // COGS: expense accounts with account code starting with '5' (5000–5999)
  const cogsAmount = expenseAccounts
    .filter(b => b.account_code.startsWith('5'))
    .reduce((s, b) => s + b.total_debit - b.total_credit, 0)

  const grossProfit = revenue - cogsAmount

  // Total expenses: debit is the normal balance side
  const totalExpenses = expenseAccounts.reduce((s, b) => s + b.total_debit - b.total_credit, 0)

  const netIncome = revenue - totalExpenses

  // Cash flow: credit - debit for each group
  const operatingCF = [...revenueAccounts, ...expenseAccounts]
    .reduce((s, b) => s + b.total_credit - b.total_debit, 0)
  const investingCF = assetAccounts
    .reduce((s, b) => s + b.total_credit - b.total_debit, 0)
  const financingCF = liabilityEquityAccounts
    .reduce((s, b) => s + b.total_credit - b.total_debit, 0)
  const netCashFlow = operatingCF + investingCF + financingCF

  return {
    revenue,
    grossProfit,
    netIncome,
    totalExpenses,
    netCashFlow,
    grossMargin: revenue > 0 ? (grossProfit / revenue) * 100 : null,
    netMargin: revenue > 0 ? (netIncome / revenue) * 100 : null,
  }
}

/** Shifts `from`–`to` back by the same number of days (window immediately before). */
export function getMomPrior(from: string, to: string): { from: string; to: string } {
  const fromDate = new Date(from + 'T00:00:00Z')
  const toDate = new Date(to + 'T00:00:00Z')
  const days = Math.round((toDate.getTime() - fromDate.getTime()) / 86400000) + 1

  const newTo = new Date(fromDate)
  newTo.setUTCDate(newTo.getUTCDate() - 1)

  const newFrom = new Date(newTo)
  newFrom.setUTCDate(newFrom.getUTCDate() - days + 1)

  return {
    from: newFrom.toISOString().split('T')[0],
    to: newTo.toISOString().split('T')[0],
  }
}

/** Shifts `from`–`to` back by exactly one year. */
export function getYoyPrior(from: string, to: string): { from: string; to: string } {
  const fromDate = new Date(from + 'T00:00:00Z')
  const toDate = new Date(to + 'T00:00:00Z')
  fromDate.setUTCFullYear(fromDate.getUTCFullYear() - 1)
  toDate.setUTCFullYear(toDate.getUTCFullYear() - 1)
  return {
    from: fromDate.toISOString().split('T')[0],
    to: toDate.toISOString().split('T')[0],
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run src/lib/kpi/__tests__/compute.test.ts --reporter=verbose 2>&1
```

Expected: all 10 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/types/index.ts src/lib/kpi/compute.ts src/lib/kpi/__tests__/compute.test.ts
git commit -m "feat: KPI types + computation functions"
```

---

## Task 2: API routes

**Files:**
- Create: `src/app/api/kpi/route.ts`
- Create: `src/app/api/kpi/trend/route.ts`

- [ ] **Step 1: Create GET /api/kpi**

Create `src/app/api/kpi/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { permissions } from '@/lib/rbac/permissions'
import { LedgerRepository } from '@/lib/db/repositories/ledger-repository'
import { computeKPIs, getMomPrior, getYoyPrior } from '@/lib/kpi/compute'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession()
    if (!permissions.dashboard.view(session.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    if (!from || !to) {
      return NextResponse.json({ error: 'from and to are required' }, { status: 400 })
    }

    const orgId = session.org.id
    const momPeriod = getMomPrior(from, to)
    const yoyPeriod = getYoyPrior(from, to)

    const [currentBalances, momBalances, yoyBalances] = await Promise.all([
      LedgerRepository.getAccountBalances(orgId, from, to),
      LedgerRepository.getAccountBalances(orgId, momPeriod.from, momPeriod.to),
      LedgerRepository.getAccountBalances(orgId, yoyPeriod.from, yoyPeriod.to),
    ])

    const current = computeKPIs(currentBalances)
    const mom = computeKPIs(momBalances)
    const yoy = computeKPIs(yoyBalances)

    const revenueGrowthRate = mom.revenue > 0
      ? ((current.revenue - mom.revenue) / mom.revenue) * 100
      : null

    const expenseBreakdown = currentBalances
      .filter(b => b.account_type === 'expense' && b.total_debit > b.total_credit)
      .map(b => ({ name: b.account_name, value: b.total_debit - b.total_credit }))
      .sort((a, b) => b.value - a.value)

    const fromLabel = new Date(from + 'T00:00:00Z').toLocaleDateString('en-US', {
      month: 'short', day: 'numeric',
    })
    const toLabel = new Date(to + 'T00:00:00Z').toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    })

    return NextResponse.json({
      current,
      mom,
      yoy,
      revenueGrowthRate,
      expenseBreakdown,
      periodLabel: `${fromLabel} – ${toLabel}`,
      generatedAt: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load KPIs' },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: Create GET /api/kpi/trend**

Create `src/app/api/kpi/trend/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { LedgerRepository } from '@/lib/db/repositories/ledger-repository'
import { computeKPIs } from '@/lib/kpi/compute'

export const runtime = 'nodejs'

function getTrailing12Months(): { month: string; from: string; to: string }[] {
  const now = new Date()
  const result = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    const y = d.getUTCFullYear()
    const m = d.getUTCMonth()
    const from = new Date(Date.UTC(y, m, 1)).toISOString().split('T')[0]
    const to =
      i === 0
        ? now.toISOString().split('T')[0]
        : new Date(Date.UTC(y, m + 1, 0)).toISOString().split('T')[0]
    result.push({
      month: `${y}-${String(m + 1).padStart(2, '0')}`,
      from,
      to,
    })
  }
  return result
}

export async function GET() {
  try {
    const session = await requireSession()
    const orgId = session.org.id
    const months = getTrailing12Months()

    const balancesPerMonth = await Promise.all(
      months.map(m => LedgerRepository.getAccountBalances(orgId, m.from, m.to))
    )

    const result = months.map((m, i) => {
      const kpis = computeKPIs(balancesPerMonth[i])
      return { month: m.month, revenue: kpis.revenue, netIncome: kpis.netIncome }
    })

    return NextResponse.json({ months: result })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load trend data' },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/kpi/route.ts src/app/api/kpi/trend/route.ts
git commit -m "feat: KPI API routes (metrics + trend)"
```

---

## Task 3: TanStack Query hooks

**Files:**
- Create: `src/hooks/use-kpi.ts`

- [ ] **Step 1: Create use-kpi.ts**

Create `src/hooks/use-kpi.ts`:

```ts
'use client'

import { useQuery } from '@tanstack/react-query'
import type { KPIResponse, KPITrendResponse } from '@/types'
import type { StatementPeriod } from './use-statements'

export type { StatementPeriod }

export function useKPI(period: StatementPeriod | null) {
  const params = period
    ? new URLSearchParams({ from: period.from, to: period.to }).toString()
    : ''

  return useQuery<KPIResponse>({
    queryKey: ['kpi', period],
    queryFn: () =>
      fetch(`/api/kpi?${params}`).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error ?? 'Failed to load KPIs')
        return r.json()
      }),
    enabled: !!period,
  })
}

export function useKPITrend() {
  return useQuery<KPITrendResponse>({
    queryKey: ['kpi-trend'],
    queryFn: () =>
      fetch('/api/kpi/trend').then(async r => {
        if (!r.ok) throw new Error((await r.json()).error ?? 'Failed to load trend data')
        return r.json()
      }),
    staleTime: 5 * 60 * 1000, // 5 minutes — trend data changes slowly
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/use-kpi.ts
git commit -m "feat: useKPI and useKPITrend hooks"
```

---

## Task 4: KPICard component

**Files:**
- Create: `src/components/dashboard/kpi-card.tsx`

- [ ] **Step 1: Create kpi-card.tsx**

Create `src/components/dashboard/kpi-card.tsx`:

```tsx
'use client'

import { cn } from '@/lib/utils'

interface KPICardProps {
  label: string
  value: number | null
  /** 'currency' = USD integer. 'growth' = signed % e.g. "+12.3%" */
  format: 'currency' | 'growth'
  /** Optional secondary line, e.g. "Margin: 70.2%" */
  secondary?: string | null
  /** Prior-period value for MoM badge (hidden if 0 or undefined) */
  momValue?: number | null
  /** Prior-period value for YoY badge (hidden if 0 or undefined) */
  yoyValue?: number | null
  /** Invert badge colours — up is bad (used for expenses) */
  invertBadge?: boolean
}

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

function pctChange(current: number, prior: number): number {
  return prior !== 0 ? ((current - prior) / Math.abs(prior)) * 100 : 0
}

function Badge({
  pct,
  label,
  invert,
}: {
  pct: number
  label: string
  invert?: boolean
}) {
  const isPositive = invert ? pct <= 0 : pct >= 0
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium',
        isPositive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
      )}
    >
      {pct >= 0 ? '↑' : '↓'} {Math.abs(pct).toFixed(1)}% {label}
    </span>
  )
}

export function KPICard({
  label,
  value,
  format,
  secondary,
  momValue,
  yoyValue,
  invertBadge,
}: KPICardProps) {
  const displayValue =
    value === null || value === undefined
      ? '—'
      : format === 'currency'
        ? USD.format(value)
        : `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`

  const showMom = typeof momValue === 'number' && momValue !== 0 && value !== null
  const showYoy = typeof yoyValue === 'number' && yoyValue !== 0 && value !== null

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">{label}</p>
      <p
        className="text-2xl font-bold text-gray-900"
        style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif' }}
      >
        {displayValue}
      </p>
      {secondary && <p className="text-xs text-gray-400">{secondary}</p>}
      {(showMom || showYoy) && (
        <div className="flex flex-wrap gap-1.5">
          {showMom && (
            <Badge
              pct={pctChange(value!, momValue!)}
              label="MoM"
              invert={invertBadge}
            />
          )}
          {showYoy && (
            <Badge
              pct={pctChange(value!, yoyValue!)}
              label="YoY"
              invert={invertBadge}
            />
          )}
        </div>
      )}
      {showMom && (
        <p className="text-xs text-gray-400">vs {USD.format(momValue!)} prev period</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/kpi-card.tsx
git commit -m "feat: KPICard component with MoM/YoY badges"
```

---

## Task 5: RevenueTrendChart component

**Files:**
- Create: `src/components/dashboard/revenue-trend-chart.tsx`

- [ ] **Step 1: Create revenue-trend-chart.tsx**

Create `src/components/dashboard/revenue-trend-chart.tsx`:

```tsx
'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { KPITrendMonth } from '@/types'

interface RevenueTrendChartProps {
  data: KPITrendMonth[]
}

const USD_FULL = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`
  return `$${n.toFixed(0)}`
}

function fmtMonthLabel(m: string): string {
  const [year, month] = m.split('-')
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-US', { month: 'short' })
}

function fmtMonthFull(m: string): string {
  const [year, month] = m.split('-')
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

export function RevenueTrendChart({ data }: RevenueTrendChartProps) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-400">
        No data available
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="revenue-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#1a1a1a" stopOpacity={0.1} />
            <stop offset="95%" stopColor="#1a1a1a" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="income-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#16a34a" stopOpacity={0.12} />
            <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis
          dataKey="month"
          tickFormatter={fmtMonthLabel}
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={fmtCompact}
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <Tooltip
          formatter={(value: number, name: string) => [
            USD_FULL.format(value),
            name === 'revenue' ? 'Revenue' : 'Net Income',
          ]}
          labelFormatter={(label: string) => fmtMonthFull(label)}
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: '1px solid #e5e7eb',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          }}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="#1a1a1a"
          strokeWidth={2}
          fill="url(#revenue-grad)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
        <Area
          type="monotone"
          dataKey="netIncome"
          stroke="#16a34a"
          strokeWidth={2}
          fill="url(#income-grad)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/revenue-trend-chart.tsx
git commit -m "feat: RevenueTrendChart (Recharts AreaChart)"
```

---

## Task 6: ExpenseDonutChart component

**Files:**
- Create: `src/components/dashboard/expense-donut-chart.tsx`

- [ ] **Step 1: Create expense-donut-chart.tsx**

Create `src/components/dashboard/expense-donut-chart.tsx`:

```tsx
'use client'

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface ExpenseSlice {
  name: string
  value: number
}

interface ExpenseDonutChartProps {
  data: ExpenseSlice[]
}

// Monochrome palette: dark → light gray
const COLORS = ['#1a1a1a', '#3d3d3d', '#616161', '#858585', '#a8a8a8', '#cccccc']

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export function ExpenseDonutChart({ data }: ExpenseDonutChartProps) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-400">
        No expense data for this period
      </div>
    )
  }

  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          cx="38%"
          cy="50%"
          innerRadius={55}
          outerRadius={82}
          paddingAngle={2}
          dataKey="value"
          strokeWidth={0}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number, name: string) => [
            `${USD.format(value)} (${((value / total) * 100).toFixed(1)}%)`,
            name,
          ]}
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: '1px solid #e5e7eb',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          }}
        />
        <Legend
          layout="vertical"
          align="right"
          verticalAlign="middle"
          iconType="circle"
          iconSize={8}
          formatter={(value: string) => (
            <span style={{ fontSize: 11, color: '#6b7280' }}>{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/expense-donut-chart.tsx
git commit -m "feat: ExpenseDonutChart (Recharts PieChart)"
```

---

## Task 7: Dashboard page

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`

The current file is a server component. Replace it entirely with a client component.

- [ ] **Step 1: Replace dashboard/page.tsx**

Replace the full contents of `src/app/(app)/dashboard/page.tsx` with:

```tsx
'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PeriodSelector } from '@/components/statements/period-selector'
import { KPICard } from '@/components/dashboard/kpi-card'
import { RevenueTrendChart } from '@/components/dashboard/revenue-trend-chart'
import { ExpenseDonutChart } from '@/components/dashboard/expense-donut-chart'
import { useKPI, useKPITrend } from '@/hooks/use-kpi'
import { getMTD, type StatementPeriod } from '@/hooks/use-statements'
import { cn } from '@/lib/utils'

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

export default function DashboardPage() {
  const [period, setPeriod] = useState<StatementPeriod>(getMTD())

  const { data, isLoading, error, refetch, isFetching } = useKPI(period)
  const { data: trendData } = useKPITrend()

  const c = data?.current
  const mom = data?.mom
  const yoy = data?.yoy

  const grossMarginLabel =
    c?.grossMargin != null ? `Margin: ${c.grossMargin.toFixed(1)}%` : null
  const netMarginLabel =
    c?.netMargin != null ? `Margin: ${c.netMargin.toFixed(1)}%` : null
  const growthSecondary =
    mom?.revenue ? `vs ${USD.format(mom.revenue)} prev period` : null

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1
            className="text-2xl font-bold text-gray-900"
            style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif' }}
          >
            Dashboard
          </h1>
          {data?.periodLabel && (
            <p className="text-sm text-gray-500 mt-1">{data.periodLabel}</p>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <PeriodSelector value={period} onChange={setPeriod} />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-gray-500 hover:text-gray-700"
          >
            <RefreshCw className={cn('w-3.5 h-3.5 mr-1.5', isFetching && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error state */}
      {error && !isLoading && (
        <div className="flex items-center justify-center py-16 text-center">
          <div>
            <p className="text-sm font-medium text-gray-700">Failed to load dashboard</p>
            <p className="text-sm text-gray-400 mt-1">
              {error instanceof Error ? error.message : 'Unknown error'}
            </p>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-gray-200 p-6 h-40 animate-pulse space-y-3"
              >
                <div className="h-3 bg-gray-100 rounded w-24" />
                <div className="h-8 bg-gray-100 rounded w-32" />
                <div className="h-3 bg-gray-100 rounded w-20" />
                <div className="flex gap-2">
                  <div className="h-5 bg-gray-100 rounded-full w-16" />
                  <div className="h-5 bg-gray-100 rounded-full w-16" />
                </div>
              </div>
            ))
          : c && (
              <>
                <KPICard
                  label="Total Revenue"
                  value={c.revenue}
                  format="currency"
                  momValue={mom?.revenue}
                  yoyValue={yoy?.revenue}
                />
                <KPICard
                  label="Gross Profit"
                  value={c.grossProfit}
                  format="currency"
                  secondary={grossMarginLabel}
                  momValue={mom?.grossProfit}
                  yoyValue={yoy?.grossProfit}
                />
                <KPICard
                  label="Net Income"
                  value={c.netIncome}
                  format="currency"
                  secondary={netMarginLabel}
                  momValue={mom?.netIncome}
                  yoyValue={yoy?.netIncome}
                />
                <KPICard
                  label="Total Expenses"
                  value={c.totalExpenses}
                  format="currency"
                  momValue={mom?.totalExpenses}
                  yoyValue={yoy?.totalExpenses}
                  invertBadge
                />
                <KPICard
                  label="Net Cash Flow"
                  value={c.netCashFlow}
                  format="currency"
                  momValue={mom?.netCashFlow}
                  yoyValue={yoy?.netCashFlow}
                />
                <KPICard
                  label="Revenue Growth Rate"
                  value={data?.revenueGrowthRate ?? null}
                  format="growth"
                  secondary={growthSecondary}
                />
              </>
            )}
      </div>

      {/* Charts */}
      {!isLoading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <p className="text-sm font-semibold text-gray-700">Revenue Trend</p>
            <p className="text-xs text-gray-400 mt-0.5 mb-4">Trailing 12 months</p>
            <RevenueTrendChart data={trendData?.months ?? []} />
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 bg-gray-900 rounded" />
                <span className="text-xs text-gray-500">Revenue</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 bg-green-600 rounded" />
                <span className="text-xs text-gray-500">Net Income</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <p className="text-sm font-semibold text-gray-700">Expense Breakdown</p>
            <p className="text-xs text-gray-400 mt-0.5 mb-4">Selected period</p>
            <ExpenseDonutChart data={data?.expenseBreakdown ?? []} />
          </div>
        </div>
      )}

      {/* Timestamp */}
      {data?.generatedAt && (
        <p className="text-xs text-gray-400 text-right">
          As of {new Date(data.generatedAt).toLocaleString()}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run the build**

```bash
cd /Users/faris/Documents/Humaris && npm run build 2>&1 | tail -40
```

Expected: build completes with no TypeScript errors. `/dashboard`, `/api/kpi`, and `/api/kpi/trend` all appear in the route list.

If there are TypeScript errors, fix them before committing.

- [ ] **Step 3: Run all tests**

```bash
npx vitest run --reporter=verbose 2>&1
```

Expected: all tests pass (10 KPI tests + previous 10 statement tests = 20 total).

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/dashboard/page.tsx
git commit -m "feat: live KPI dashboard (6 cards, trend chart, expense donut)"
```

---

## Task 8: Final Sprint 6 commit and push

- [ ] **Step 1: Check git status**

```bash
git status
```

Expected: clean working tree. If any files are untracked or modified, stage and commit them.

- [ ] **Step 2: Final commit**

```bash
git commit --allow-empty -m "feat: Sprint 6 — KPI Dashboard complete"
```

- [ ] **Step 3: Push**

```bash
git push humarisremote main
```

Expected: push succeeds, all Sprint 6 commits appear on GitHub.
