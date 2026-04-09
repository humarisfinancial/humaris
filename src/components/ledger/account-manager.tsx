'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  useChartOfAccounts,
  useCreateAccount,
  useUpdateAccount,
  useDeleteAccount,
} from '@/hooks/use-ledger'
import type { ChartOfAccount, AccountType } from '@/types'

const ACCOUNT_TYPES: AccountType[] = ['asset', 'liability', 'equity', 'revenue', 'expense']

const TYPE_LABELS: Record<AccountType, string> = {
  asset: 'Asset',
  liability: 'Liability',
  equity: 'Equity',
  revenue: 'Revenue',
  expense: 'Expense',
}

const TYPE_STYLES: Record<AccountType, string> = {
  asset: 'bg-blue-50 text-blue-700',
  liability: 'bg-red-50 text-red-700',
  equity: 'bg-purple-50 text-purple-700',
  revenue: 'bg-green-50 text-green-700',
  expense: 'bg-orange-50 text-orange-700',
}

interface AccountFormState {
  code: string
  name: string
  type: AccountType
}

const DEFAULT_FORM: AccountFormState = { code: '', name: '', type: 'expense' }

export function AccountManager() {
  const { data, isLoading } = useChartOfAccounts()
  const accounts = data?.accounts ?? []

  const { mutateAsync: createAccount, isPending: isCreating } = useCreateAccount()
  const { mutateAsync: updateAccount, isPending: isUpdating } = useUpdateAccount()
  const { mutate: deleteAccount } = useDeleteAccount()

  const [showForm, setShowForm] = useState(false)
  const [editAccount, setEditAccount] = useState<ChartOfAccount | null>(null)
  const [form, setForm] = useState<AccountFormState>(DEFAULT_FORM)
  const [filterType, setFilterType] = useState<string>('_all')

  const filteredAccounts = filterType === '_all'
    ? accounts
    : accounts.filter(a => a.type === filterType)

  // Group for display
  const grouped = filteredAccounts.reduce<Record<string, ChartOfAccount[]>>((acc, account) => {
    if (!acc[account.type]) acc[account.type] = []
    acc[account.type].push(account)
    return acc
  }, {})

  function openCreate() {
    setForm(DEFAULT_FORM)
    setEditAccount(null)
    setShowForm(true)
  }

  function openEdit(account: ChartOfAccount) {
    setForm({ code: account.code, name: account.name, type: account.type })
    setEditAccount(account)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditAccount(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.code || !form.name) {
      toast.error('Code and name are required')
      return
    }

    try {
      if (editAccount) {
        await updateAccount({ id: editAccount.id, name: form.name, type: form.type })
        toast.success('Account updated')
      } else {
        await createAccount({ code: form.code, name: form.name, type: form.type })
        toast.success('Account created')
      }
      closeForm()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save account')
    }
  }

  function handleDelete(account: ChartOfAccount) {
    if (account.is_system) { toast.error('System accounts cannot be deleted'); return }
    if (!confirm(`Delete account "${account.code} — ${account.name}"?`)) return
    deleteAccount(account.id, {
      onSuccess: () => toast.success('Account deleted'),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to delete'),
    })
  }

  const isPending = isCreating || isUpdating

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <Select
          value={filterType}
          onValueChange={(v) => setFilterType(v ?? '_all')}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All types</SelectItem>
            {ACCOUNT_TYPES.map(t => (
              <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto text-sm text-gray-500">{filteredAccounts.length} accounts</div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1" />
          Add Account
        </Button>
      </div>

      {/* Account list grouped by type */}
      {isLoading ? (
        <div className="py-12 text-center text-gray-400 text-sm">Loading…</div>
      ) : filteredAccounts.length === 0 ? (
        <div className="py-12 text-center text-gray-400 text-sm">No accounts found.</div>
      ) : (
        <div className="space-y-4">
          {ACCOUNT_TYPES.filter(t => grouped[t]?.length).map(type => (
            <div key={type} className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${TYPE_STYLES[type]}`}>
                  {TYPE_LABELS[type]}
                </span>
                <span className="text-xs text-gray-400">{grouped[type].length} accounts</span>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {grouped[type].map((account, i) => (
                    <tr
                      key={account.id}
                      className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                        i === grouped[type].length - 1 ? 'border-b-0' : ''
                      }`}
                    >
                      <td className="px-4 py-2.5 w-24">
                        <span className="font-mono text-gray-500 text-xs">{account.code}</span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-900 font-medium">
                        {account.name}
                      </td>
                      <td className="px-4 py-2.5 w-16">
                        {account.is_system && (
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <Lock className="w-3 h-3" />
                            System
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 w-20">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => openEdit(account)}
                            className="p-1.5 text-gray-400 hover:text-gray-700 rounded cursor-pointer transition-colors"
                            aria-label="Edit account"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {!account.is_system && (
                            <button
                              onClick={() => handleDelete(account)}
                              className="p-1.5 text-gray-400 hover:text-red-600 rounded cursor-pointer transition-colors"
                              aria-label="Delete account"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit dialog */}
      <Dialog open={showForm} onOpenChange={open => !open && closeForm()}>
        <DialogContent className="max-w-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            {editAccount ? 'Edit Account' : 'New Account'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!editAccount && (
              <div className="space-y-1.5">
                <Label htmlFor="acc-code">Account Code</Label>
                <Input
                  id="acc-code"
                  placeholder="e.g. 6110"
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                  required
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="acc-name">Account Name</Label>
              <Input
                id="acc-name"
                placeholder="e.g. Professional Fees"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acc-type">Type</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm(f => ({ ...f, type: v as AccountType }))}
              >
                <SelectTrigger id="acc-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map(t => (
                    <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="submit" disabled={isPending} className="flex-1">
                {isPending ? 'Saving…' : editAccount ? 'Update' : 'Create'}
              </Button>
              <Button type="button" variant="outline" onClick={closeForm}>Cancel</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
