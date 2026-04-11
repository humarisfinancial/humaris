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
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}
