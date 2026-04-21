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
} from '@/hooks/use-statements'
import type { StatementType } from '@/types'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useStatementsPeriod } from '@/contexts/period-context'

const STATEMENT_TYPES: { value: StatementType; label: string }[] = [
  { value: 'pnl', label: 'Profit & Loss' },
  { value: 'balance_sheet', label: 'Balance Sheet' },
  { value: 'cash_flow', label: 'Cash Flow' },
]

export default function StatementsPage() {
  const [activeType, setActiveType] = useState<StatementType>('pnl')
  const [period, setPeriod] = useStatementsPeriod()

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
    <div className="w-full px-3 sm:px-5 lg:px-8 py-4 sm:py-6 space-y-6">
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

      {!isLoading && statement && (() => {
        const isEmptyBalanceSheet =
          activeType === 'balance_sheet' &&
          statement.data.sections.every(s => s.amount === 0 && !(s.children?.length))
        if (isEmptyBalanceSheet) {
          return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-sm font-medium text-gray-700">No balance sheet entries for this period</p>
              <p className="text-sm text-gray-400 mt-1 max-w-sm">
                The balance sheet only includes asset, liability, and equity accounts.
                Add entries to those account types to see data here.
              </p>
              <a href="/ledger" className="mt-4 text-sm font-medium text-gray-900 underline underline-offset-2">
                Go to Ledger
              </a>
            </div>
          )
        }
        return (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-x-auto">
            <StatementTable
              data={statement.data}
              generatedAt={statement.generated_at}
            />
          </div>
        )
      })()}
    </div>
  )
}
