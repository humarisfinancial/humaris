'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { LedgerEntry, ChartOfAccount, PaginatedResult } from '@/types'
import type { AccountBalance } from '@/lib/db/repositories/ledger-repository'

// ── Ledger entries ────────────────────────────────────────────

interface LedgerFilters {
  account_id?: string
  date_from?: string
  date_to?: string
  is_manual?: boolean
  page?: number
  per_page?: number
}

export function useLedgerEntries(filters: LedgerFilters = {}) {
  const params = new URLSearchParams()
  if (filters.account_id) params.set('account_id', filters.account_id)
  if (filters.date_from) params.set('date_from', filters.date_from)
  if (filters.date_to) params.set('date_to', filters.date_to)
  if (filters.is_manual !== undefined) params.set('is_manual', String(filters.is_manual))
  if (filters.page) params.set('page', String(filters.page))
  if (filters.per_page) params.set('per_page', String(filters.per_page))

  return useQuery<PaginatedResult<LedgerEntry>>({
    queryKey: ['ledger', 'entries', filters],
    queryFn: () => fetch(`/api/ledger?${params}`).then(r => r.json()),
  })
}

export function useLedgerEntry(id: string) {
  return useQuery<{ entry: LedgerEntry }>({
    queryKey: ['ledger', 'entry', id],
    queryFn: () => fetch(`/api/ledger/${id}`).then(r => r.json()),
    enabled: !!id,
  })
}

export function useCreateLedgerEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: {
      account_id: string
      entry_date: string
      description?: string
      debit?: number
      credit?: number
      category?: string
    }) => {
      const res = await fetch('/api/ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Failed to create entry')
      }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ledger'] })
    },
  })
}

export function useUpdateLedgerEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; [key: string]: unknown }) => {
      const res = await fetch(`/api/ledger/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Failed to update entry')
      }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ledger'] })
    },
  })
}

export function useDeleteLedgerEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/ledger/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Failed to delete entry')
      }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ledger'] })
    },
  })
}

// ── Chart of accounts ─────────────────────────────────────────

export function useChartOfAccounts() {
  return useQuery<{ accounts: ChartOfAccount[] }>({
    queryKey: ['ledger', 'accounts'],
    queryFn: () => fetch('/api/ledger/accounts').then(r => r.json()),
  })
}

export function useCreateAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: {
      code: string
      name: string
      type: string
      parent_id?: string | null
    }) => {
      const res = await fetch('/api/ledger/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Failed to create account')
      }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ledger', 'accounts'] })
    },
  })
}

export function useUpdateAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; [key: string]: unknown }) => {
      const res = await fetch(`/api/ledger/accounts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Failed to update account')
      }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ledger', 'accounts'] })
    },
  })
}

export function useDeleteAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/ledger/accounts/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Failed to delete account')
      }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ledger', 'accounts'] })
    },
  })
}

// ── Account balances ──────────────────────────────────────────

interface BalanceFilters {
  date_from?: string
  date_to?: string
}

export function useAccountBalances(filters: BalanceFilters = {}) {
  const params = new URLSearchParams()
  if (filters.date_from) params.set('date_from', filters.date_from)
  if (filters.date_to) params.set('date_to', filters.date_to)

  return useQuery<{ balances: AccountBalance[] }>({
    queryKey: ['ledger', 'balances', filters],
    queryFn: () => fetch(`/api/ledger/balances?${params}`).then(r => r.json()),
  })
}
