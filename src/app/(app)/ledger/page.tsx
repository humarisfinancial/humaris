'use client'

import { useState } from 'react'
import { Plus, BookOpen, LayoutList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { LedgerTable } from '@/components/ledger/ledger-table'
import { AccountManager } from '@/components/ledger/account-manager'
import { EntryForm } from '@/components/ledger/entry-form'
import { useAccountBalances } from '@/hooks/use-ledger'

type Tab = 'entries' | 'accounts'

export default function LedgerPage() {
  const [tab, setTab] = useState<Tab>('entries')
  const [showNewEntry, setShowNewEntry] = useState(false)

  const { data: balancesData } = useAccountBalances()
  const balances = balancesData?.balances ?? []

  // Aggregate summary figures
  const totalRevenue = balances
    .filter(b => b.account_type === 'revenue')
    .reduce((sum, b) => sum + b.balance, 0)
  const totalExpenses = balances
    .filter(b => b.account_type === 'expense')
    .reduce((sum, b) => sum + b.balance, 0)
  const netIncome = totalRevenue - totalExpenses

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ledger</h1>
          <p className="text-gray-500 mt-1 text-sm">Double-entry ledger — track all transactions</p>
        </div>
        <Button size="sm" onClick={() => setShowNewEntry(true)}>
          <Plus className="w-4 h-4 mr-1" />
          New Entry
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard label="Total Revenue" value={totalRevenue} positive />
        <SummaryCard label="Total Expenses" value={totalExpenses} />
        <SummaryCard label="Net Income" value={netIncome} highlight />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          <TabButton
            label="Entries"
            icon={<LayoutList className="w-4 h-4" />}
            active={tab === 'entries'}
            onClick={() => setTab('entries')}
          />
          <TabButton
            label="Chart of Accounts"
            icon={<BookOpen className="w-4 h-4" />}
            active={tab === 'accounts'}
            onClick={() => setTab('accounts')}
          />
        </nav>
      </div>

      {/* Content */}
      {tab === 'entries' && <LedgerTable />}
      {tab === 'accounts' && <AccountManager />}

      {/* New entry dialog */}
      <Dialog open={showNewEntry} onOpenChange={setShowNewEntry}>
        <DialogContent className="max-w-md">
          <h2 className="text-base font-semibold text-gray-900 mb-4">New Ledger Entry</h2>
          <EntryForm
            onSuccess={() => setShowNewEntry(false)}
            onCancel={() => setShowNewEntry(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  positive,
  highlight,
}: {
  label: string
  value: number
  positive?: boolean
  highlight?: boolean
}) {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Math.abs(value))

  const isNegative = value < 0

  return (
    <div className={`rounded-xl border p-5 ${highlight ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white'}`}>
      <p className={`text-xs font-medium uppercase tracking-wide mb-2 ${highlight ? 'text-gray-400' : 'text-gray-500'}`}>
        {label}
      </p>
      <p className={`text-2xl font-bold tabular-nums ${
        highlight
          ? isNegative ? 'text-red-400' : 'text-white'
          : positive
            ? 'text-green-600'
            : isNegative ? 'text-red-600' : 'text-gray-900'
      }`}>
        {isNegative ? '−' : ''}{formatted}
      </p>
    </div>
  )
}

function TabButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string
  icon: React.ReactNode
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-1 pb-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
        active
          ? 'border-gray-900 text-gray-900'
          : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}
