'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { useCreateLedgerEntry, useUpdateLedgerEntry, useChartOfAccounts } from '@/hooks/use-ledger'
import type { LedgerEntry, ChartOfAccount } from '@/types'

interface EntryFormProps {
  entry?: LedgerEntry
  onSuccess?: () => void
  onCancel?: () => void
}

export function EntryForm({ entry, onSuccess, onCancel }: EntryFormProps) {
  const isEdit = !!entry
  const { data: accountsData } = useChartOfAccounts()
  const accounts = accountsData?.accounts ?? []

  const [accountId, setAccountId] = useState(entry?.account_id ?? '')
  const [entryDate, setEntryDate] = useState(
    entry?.entry_date ?? new Date().toISOString().split('T')[0]
  )
  const [description, setDescription] = useState(entry?.description ?? '')
  const [type, setType] = useState<'debit' | 'credit'>(
    entry ? (entry.debit > 0 ? 'debit' : 'credit') : 'debit'
  )
  const [amount, setAmount] = useState(
    entry ? String(entry.debit > 0 ? entry.debit : entry.credit) : ''
  )
  const [category, setCategory] = useState(entry?.category ?? '')

  const { mutateAsync: createEntry, isPending: isCreating } = useCreateLedgerEntry()
  const { mutateAsync: updateEntry, isPending: isUpdating } = useUpdateLedgerEntry()
  const isPending = isCreating || isUpdating

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!accountId) { toast.error('Select an account'); return }
    if (!entryDate) { toast.error('Enter a date'); return }
    const amountNum = parseFloat(amount)
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      toast.error('Enter a valid positive amount')
      return
    }

    const debit = type === 'debit' ? amountNum : 0
    const credit = type === 'credit' ? amountNum : 0

    try {
      if (isEdit) {
        await updateEntry({
          id: entry.id,
          account_id: accountId,
          entry_date: entryDate,
          description: description || null,
          debit,
          credit,
          category: category || null,
        })
        toast.success('Entry updated')
      } else {
        await createEntry({
          account_id: accountId,
          entry_date: entryDate,
          description: description || undefined,
          debit,
          credit,
          category: category || undefined,
        })
        toast.success('Entry created')
      }
      onSuccess?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save entry')
    }
  }

  // Group accounts by type for the select
  const groupedAccounts = accounts.reduce<Record<string, ChartOfAccount[]>>((acc, account) => {
    if (!acc[account.type]) acc[account.type] = []
    acc[account.type].push(account)
    return acc
  }, {})

  const typeLabels: Record<string, string> = {
    asset: 'Assets',
    liability: 'Liabilities',
    equity: 'Equity',
    revenue: 'Revenue',
    expense: 'Expenses',
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Account */}
      <div className="space-y-1.5">
        <Label htmlFor="account">Account</Label>
        <Select value={accountId} onValueChange={(v) => setAccountId(v ?? '')}>
          <SelectTrigger id="account">
            <SelectValue placeholder="Select account…">
              {accounts.find(a => a.id === accountId)
                ? `${accounts.find(a => a.id === accountId)!.code} — ${accounts.find(a => a.id === accountId)!.name}`
                : undefined}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(groupedAccounts).map(([type, accs]) => (
              <div key={type}>
                <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {typeLabels[type] ?? type}
                </div>
                {accs.map(acc => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.code} — {acc.name}
                  </SelectItem>
                ))}
              </div>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Date */}
      <div className="space-y-1.5">
        <Label htmlFor="entry-date">Date</Label>
        <Input
          id="entry-date"
          type="date"
          value={entryDate}
          onChange={e => setEntryDate(e.target.value)}
          required
        />
      </div>

      {/* Debit / Credit toggle + amount */}
      <div className="space-y-1.5">
        <Label>Amount</Label>
        <div className="flex gap-2">
          <div className="flex rounded-md border border-gray-200 overflow-hidden">
            <button
              type="button"
              className={`px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
                type === 'debit'
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
              onClick={() => setType('debit')}
            >
              Debit
            </button>
            <button
              type="button"
              className={`px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
                type === 'credit'
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
              onClick={() => setType('credit')}
            >
              Credit
            </button>
          </div>
          <Input
            type="number"
            step="0.01"
            min="0.01"
            placeholder="0.00"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="flex-1"
            required
          />
        </div>
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Optional note…"
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={2}
        />
      </div>

      {/* Category */}
      <div className="space-y-1.5">
        <Label htmlFor="category">Category</Label>
        <Select value={category || '__none__'} onValueChange={v => setCategory(v === '__none__' ? '' : v)}>
          <SelectTrigger id="category">
            <SelectValue placeholder="Select category…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— None —</SelectItem>
            {Object.entries(groupedAccounts).map(([type, accs]) => (
              <div key={type}>
                <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {typeLabels[type] ?? type}
                </div>
                {accs.map(acc => (
                  <SelectItem key={acc.id} value={acc.name}>
                    {acc.name}
                  </SelectItem>
                ))}
              </div>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={isPending} className="flex-1">
          {isPending ? 'Saving…' : isEdit ? 'Update Entry' : 'Create Entry'}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}
