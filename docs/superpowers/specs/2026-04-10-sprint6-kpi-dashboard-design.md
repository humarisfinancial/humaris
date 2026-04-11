# Sprint 6 — KPI Dashboard: Design Spec

**Date:** 2026-04-10
**Sprint:** 6 of 8
**Status:** Approved

---

## Overview

Sprint 6 builds the KPI Dashboard — a CFO-grade executive view auto-computed from ledger data. It replaces the current placeholder dashboard at `/dashboard` with live metrics, prior-period comparison badges, a 12-month revenue trend chart, and an expense breakdown donut. All data is derived from the existing ledger engine with no new DB tables.

---

## Scope

**In scope:**
- Six KPI metric cards: Total Revenue, Gross Profit, Net Income, Total Expenses, Net Cash Flow, Revenue Growth Rate
- Margin % shown as secondary annotation on Gross Profit and Net Income cards (not as separate cards)
- MoM and YoY comparison badges on every card
- Revenue Trend: 12-month area chart (Revenue + Net Income series, always trailing 12 months)
- Expense Breakdown: donut chart sliced by expense account category
- Period selector: MTD / QTD / YTD / custom date range (same pill component as Statements)
- Manual refresh button with "as of [timestamp]" label
- Skeleton loading states, empty states, error states

**Deferred:**
- Real-time push updates (Supabase subscriptions) — manual refresh is sufficient for MVP
- Budget vs. actual variance tracking
- Forecasting / projections
- Operational metrics (CAC, ARPU, revenue per customer)

---

## Architecture & Data Flow

### Option chosen: Thin API, compute on request (Option A)

No new DB tables. The dashboard fetches from two endpoints:

| Endpoint | Purpose |
|----------|---------|
| `GET /api/kpi?from=YYYY-MM-DD&to=YYYY-MM-DD` | KPI metrics for selected period + both comparison periods |
| `GET /api/kpi/trend` | 12 monthly buckets (trailing 12 months, fixed) for the area chart |

**KPI request flow:**
1. Client sends `GET /api/kpi?from=&to=`
2. API derives the two comparison windows:
   - **MoM prior**: same-length window shifted back by the number of days in the selected range
   - **YoY prior**: same date range one year prior
3. Three parallel `LedgerRepository.getAccountBalances()` calls (current, MoM, YoY)
4. API computes all six KPIs from each period's account balances
5. Returns `{ current, mom, yoy }` in one response

**Trend request flow:**
1. Client sends `GET /api/kpi/trend` (no params — always trailing 12 months)
2. API runs 12 monthly `getAccountBalances()` calls in parallel
3. Returns array of `{ month: 'YYYY-MM', revenue: number, netIncome: number }[]`

TanStack Query handles client-side caching. No server-side cache needed — account balance aggregation is fast.

### New Code

```
src/
├── lib/
│   └── kpi/
│       └── compute.ts              ← KPI computation from AccountBalance[]
├── hooks/
│   └── use-kpi.ts                  ← TanStack Query hooks: useKPI, useKPITrend
├── components/
│   └── dashboard/
│       ├── kpi-card.tsx            ← Metric card with MoM + YoY badges
│       ├── revenue-trend-chart.tsx ← Recharts AreaChart (12-month trend)
│       └── expense-donut-chart.tsx ← Recharts PieChart donut
└── app/
    ├── (app)/dashboard/
    │   └── page.tsx                ← Replace placeholder with live dashboard
    └── api/kpi/
        ├── route.ts                ← GET: KPI metrics + comparison periods
        └── trend/
            └── route.ts            ← GET: 12-month monthly trend data
```

---

## KPI Definitions

All values computed from `ledger_entries` via `getAccountBalances()` aggregated by account type.

| KPI | Formula |
|-----|---------|
| Total Revenue | Sum of all `revenue` account credits minus debits |
| Gross Profit | Revenue − COGS (expense accounts with code prefix `5xxx`; if none, = Revenue) |
| Net Income | Revenue − All Expenses |
| Total Expenses | Sum of all `expense` account debits minus credits |
| Net Cash Flow | Operating (revenue−expense) + Investing (asset changes) + Financing (liability+equity changes) — mirrors Cash Flow statement |
| Revenue Growth Rate | `(currentRevenue − momRevenue) / momRevenue × 100` (MoM growth %) |
| Gross Margin % | `grossProfit / revenue × 100` — shown as secondary annotation on Gross Profit card |
| Net Margin % | `netIncome / revenue × 100` — shown as secondary annotation on Net Income card |

---

## Prior Period Logic

| Comparison | Derivation |
|---|---|
| MoM | Shift `from` and `to` back by `(to - from + 1)` days |
| YoY | Subtract 1 year from both `from` and `to` |

If the prior period has no data, the badge is hidden entirely (not shown as 0% or ∞%).

---

## UI Design

### Layout

Apple-inspired: `system-ui` font, white background, `#f5f5f7` separators, generous whitespace.

```
┌─────────────────────────────────────────────────────┐
│  Dashboard                      MTD  QTD  YTD  │ ↺ │
│  Jan 1 – Apr 10, 2026                            │
├────────────┬────────────┬────────────────────────────┤
│ Revenue    │ Gross Profit│ Net Income               │
│ $124,500   │ $87,150     │ $31,400                  │
│ ↑12% MoM  │ ↑8% MoM    │ ↑5% MoM                  │
│ ↑34% YoY  │ ↑22% YoY   │ ↑18% YoY                 │
│            │ Margin: 70% │ Margin: 25%              │
├────────────┴────────────┴────────────────────────────┤
│ Total Expenses │ Net Cash Flow │ Revenue Growth Rate │
│ $55,750        │ $28,200       │ +12.3% MoM          │
│ ↑3% MoM       │ ↑9% MoM      │ vs $111,150 last mo  │
│ ↑15% YoY      │ ↑28% YoY     │                      │
├─────────────────────────┬───────────────────────────┤
│ Revenue Trend (12mo)    │ Expense Breakdown         │
│ [AreaChart]             │ [Donut]                   │
└─────────────────────────┴───────────────────────────┘
```

### Design Tokens

- Font: `system-ui, -apple-system, BlinkMacSystemFont`
- Background: `#ffffff`
- Card borders: `#e5e5e5`, `border-radius: 16px`
- Positive badge: green (`#16a34a` text, `#f0fdf4` bg)
- Negative badge: red (`#dc2626` text, `#fef2f2` bg)
- Neutral badge: gray — hidden if no prior data
- Chart primary (Revenue): `#1a1a1a`
- Chart secondary (Net Income): `#16a34a`
- Donut palette: 6-color sequence from gray-900 stepping lighter

### KPI Card Anatomy

```
┌──────────────────────────────┐
│ Total Revenue                │  ← label (small caps, gray-500)
│ $124,500                     │  ← value (2xl bold, gray-900)
│ Margin: 70%                  │  ← secondary (xs, gray-400) — only on profit cards
│ ↑ 12.3% MoM  ↑ 34.1% YoY   │  ← badges (xs, green/red pill)
│ vs $111,150 prev period      │  ← prior value (xs, gray-400)
└──────────────────────────────┘
```

### Period Selector

Reuse `<PeriodSelector>` from `src/components/statements/period-selector.tsx`. Selecting a period re-fetches KPI data automatically.

---

## API Routes

### `GET /api/kpi`

Query params: `from` (YYYY-MM-DD), `to` (YYYY-MM-DD)

Response:
```ts
{
  current: KPISnapshot
  mom: KPISnapshot
  yoy: KPISnapshot
  periodLabel: string  // e.g. "Jan 1 – Apr 10, 2026"
  generatedAt: string  // ISO timestamp
}

interface KPISnapshot {
  revenue: number
  grossProfit: number
  netIncome: number
  totalExpenses: number
  netCashFlow: number
  grossMargin: number | null  // null if revenue = 0
  netMargin: number | null    // null if revenue = 0
}

// revenueGrowthRate lives at the top level, not inside KPISnapshot,
// because it's a comparison between current and mom — not a property of either period alone
// revenueGrowthRate: number | null  (null if mom.revenue = 0)
```

### `GET /api/kpi/trend`

No params. Always returns trailing 12 calendar months.

Response:
```ts
{
  months: {
    month: string       // 'YYYY-MM'
    revenue: number
    netIncome: number
  }[]
}
```

---

## Component Design

### `<KPICard>`

Props: `label`, `value`, `format` (`currency` | `percent`), `secondary?`, `current`, `mom?`, `yoy?`

Renders: formatted value, optional secondary annotation, MoM badge, YoY badge (each hidden if the prior snapshot has zero revenue and no data).

### `<RevenueTrendChart>`

Recharts `AreaChart` with two `Area` series. X-axis: month abbreviations. Y-axis: compact USD (`$124k`). Tooltip: full values on hover. Gradient fills: dark for Revenue, light green for Net Income.

### `<ExpenseDonutChart>`

Recharts `PieChart` with `innerRadius` for donut style. One entry per expense account. `Legend` on the right side. `Tooltip` shows account name, dollar amount, and % of total.

---

## Error Handling & Edge Cases

| Scenario | Behaviour |
|---|---|
| No ledger data for period | All cards show `—`; charts show "No data for this period" empty state |
| Prior period has no data | MoM/YoY badges hidden |
| Revenue = 0 | Margin % annotations hidden; Growth Rate card shows "—" |
| Single expense category | Donut shows full ring with one slice |
| API error | Toast error + retry button |
| Loading | Skeleton pulse on all cards and chart areas |

---

## Testing

- **Unit:** `computeKPIs()` in `src/lib/kpi/compute.ts` tested with known `AccountBalance[]` fixtures asserting all six KPI values
- **Unit:** Prior period derivation functions (`getMomPrior`, `getYoyPrior`) tested with edge cases (month boundaries, leap years, year boundaries)
- **API:** Route tests for valid params, missing params, and empty ledger responses

---

## RBAC

All roles can view the dashboard. The KPI API requires only `permissions.dashboard.view` (same as existing `view` access — all authenticated org members).
