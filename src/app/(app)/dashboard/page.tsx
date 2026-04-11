'use client'

import { useState } from 'react'
import Link from 'next/link'
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
                {/* Revenue Growth Rate: value IS the MoM comparison, so no badge */}
                <KPICard
                  label="Revenue Growth Rate"
                  value={data?.revenueGrowthRate ?? null}
                  format="growth"
                  secondary={growthSecondary}
                  momValue={null}
                  yoyValue={null}
                />
              </>
            )}
      </div>

      {/* Charts */}
      {!isLoading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Revenue Trend (12 months)</h2>
            <RevenueTrendChart data={trendData?.months ?? []} />
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Expense Breakdown</h2>
            <ExpenseDonutChart data={data?.expenseBreakdown ?? []} />
          </div>
        </div>
      )}

      {/* Empty state — no data for selected period */}
      {!isLoading && !error && !c && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-sm font-medium text-gray-700">No financial data for this period</p>
          <p className="text-sm text-gray-400 mt-1">Add ledger entries to see your KPIs</p>
          <Link href="/ledger" className="mt-4 text-sm font-medium text-gray-900 underline underline-offset-2">
            Go to Ledger
          </Link>
        </div>
      )}
    </div>
  )
}
