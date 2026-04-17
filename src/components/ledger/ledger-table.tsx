'use client'

import { useState } from 'react'
import { Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from 'sonner'
import {
  useLedgerEntries,
  useDeleteLedgerEntry,
  useChartOfAccounts,
} from '@/hooks/use-ledger'
import { EntryForm } from './entry-form'
import type { LedgerEntry } from '@/types'

const PER_PAGE = 50

export function LedgerTable() {
  const [page, setPage] = useState(1)
  const [accountId, setAccountId] = useState<string>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [editEntry, setEditEntry] = useState<LedgerEntry | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<LedgerEntry | null>(null)

  const { data, isLoading } = useLedgerEntries({
    account_id: accountId || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    page,
    per_page: PER_PAGE,
  })

  const { data: accountsData } = useChartOfAccounts()
  const { mutate: deleteEntry } = useDeleteLedgerEntry()

  const entries = data?.items ?? []
  const total = data?.total ?? 0
  const hasMore = data?.has_more ?? false
  const accounts = accountsData?.accounts ?? []

  function confirmDelete() {
    if (!deleteTarget) return
    deleteEntry(deleteTarget.id, {
      onSuccess: () => toast.success('Entry deleted'),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to delete'),
    })
  }

  function resetFilters() {
    setAccountId('')
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="w-52">
          <Select
            value={accountId}
            onValueChange={(v) => { setAccountId(!v || v === '_all' ? '' : v); setPage(1) }}
          >
            <SelectTrigger>
              <SelectValue placeholder="All accounts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All accounts</SelectItem>
              {accounts.map(acc => (
                <SelectItem key={acc.id} value={acc.id}>
                  {acc.code} — {acc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2 items-center">
          <Input
            type="date"
            value={dateFrom}
            onChange={e => { setDateFrom(e.target.value); setPage(1) }}
            className="w-38"
            aria-label="Date from"
          />
          <span className="text-gray-400 text-sm">to</span>
          <Input
            type="date"
            value={dateTo}
            onChange={e => { setDateTo(e.target.value); setPage(1) }}
            className="w-38"
            aria-label="Date to"
          />
        </div>

        {(accountId || dateFrom || dateTo) && (
          <Button variant="outline" size="sm" onClick={resetFilters}>
            Clear filters
          </Button>
        )}

        <div className="ml-auto text-sm text-gray-500">
          {total} {total === 1 ? 'entry' : 'entries'}
        </div>
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded-xl overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Account</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Description</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Debit</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Credit</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Approver</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="py-12 text-center text-gray-400">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && entries.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center text-gray-400">
                  No entries found.
                </td>
              </tr>
            )}
            {entries.map((entry, i) => (
              <tr
                key={entry.id}
                className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                  i === entries.length - 1 ? 'border-b-0' : ''
                }`}
              >
                <td className="px-4 py-3 text-gray-900 whitespace-nowrap">
                  {formatDate(entry.entry_date)}
                </td>
                <td className="px-4 py-3">
                  <span className="font-medium text-gray-900">
                    {entry.account?.code}
                  </span>
                  <span className="text-gray-500 ml-1.5">{entry.account?.name}</span>
                </td>
                <td className="px-4 py-3 max-w-xs">
                  {entry.description ? (() => {
                    const parts = entry.description.split(' — ')
                    const vendor = parts.length > 1 ? parts[0] : null
                    const rest = parts.length > 1 ? parts.slice(1).join(' — ') : parts[0]
                    return vendor ? (
                      <div>
                        <span className="font-medium text-gray-900 block truncate">{vendor}</span>
                        {rest && <span className="text-xs text-gray-400 block truncate">{rest}</span>}
                      </div>
                    ) : (
                      <span className="text-gray-600 truncate block">{rest}</span>
                    )
                  })() : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {entry.debit > 0 ? (
                    <span className="text-gray-900">{formatCurrency(entry.debit)}</span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {entry.credit > 0 ? (
                    <span className="text-blue-600">{formatCurrency(entry.credit)}</span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(entry as any).creator?.full_name
                    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                    || (entry as any).creator?.email
                    || (entry.is_manual ? 'Manual' : '—')}
                </td>
                <td className="px-4 py-3 w-px whitespace-nowrap">
                  <div className="flex items-center gap-1 justify-end">
                    <button
                      onClick={() => setEditEntry(entry)}
                      className="p-1.5 text-gray-400 hover:text-gray-700 rounded cursor-pointer transition-colors"
                      aria-label="Edit entry"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(entry)}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded cursor-pointer transition-colors"
                      aria-label="Delete entry"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > PER_PAGE && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            Showing {((page - 1) * PER_PAGE) + 1}–{Math.min(page * PER_PAGE, total)} of {total}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => p - 1)}
              disabled={page === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => p + 1)}
              disabled={!hasMore}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete ledger entry"
        description="This will permanently remove the entry. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        destructive
      />

      {/* Edit dialog */}
      <Dialog open={!!editEntry} onOpenChange={open => !open && setEditEntry(null)}>
        <DialogContent className="max-w-md">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Edit Entry</h2>
          {editEntry && (
            <EntryForm
              entry={editEntry}
              onSuccess={() => setEditEntry(null)}
              onCancel={() => setEditEntry(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function formatDate(str: string): string {
  return new Date(str + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}
