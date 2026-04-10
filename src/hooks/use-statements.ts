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
