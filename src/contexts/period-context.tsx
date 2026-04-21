'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { getMTD, type StatementPeriod } from '@/hooks/use-statements'

interface PeriodState {
  dashboard: StatementPeriod
  statements: StatementPeriod
}

interface PeriodContextValue {
  dashboardPeriod: StatementPeriod
  setDashboardPeriod: (p: StatementPeriod) => void
  statementsPeriod: StatementPeriod
  setStatementsPeriod: (p: StatementPeriod) => void
}

const PeriodContext = createContext<PeriodContextValue | null>(null)

export function PeriodProvider({ children }: { children: ReactNode }) {
  const [periods, setPeriods] = useState<PeriodState>(() => ({
    dashboard: getMTD(),
    statements: getMTD(),
  }))

  // Restore from localStorage once on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('app:periods')
      if (raw) {
        const saved = JSON.parse(raw) as Partial<PeriodState>
        setPeriods(prev => ({
          dashboard: saved.dashboard ?? prev.dashboard,
          statements: saved.statements ?? prev.statements,
        }))
      }
    } catch { /* ignore */ }
  }, [])

  const setDashboardPeriod = useCallback((p: StatementPeriod) => {
    setPeriods(prev => {
      const next = { ...prev, dashboard: p }
      try { localStorage.setItem('app:periods', JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [])

  const setStatementsPeriod = useCallback((p: StatementPeriod) => {
    setPeriods(prev => {
      const next = { ...prev, statements: p }
      try { localStorage.setItem('app:periods', JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [])

  return (
    <PeriodContext.Provider value={{
      dashboardPeriod: periods.dashboard,
      setDashboardPeriod,
      statementsPeriod: periods.statements,
      setStatementsPeriod,
    }}>
      {children}
    </PeriodContext.Provider>
  )
}

export function useDashboardPeriod() {
  const ctx = useContext(PeriodContext)
  if (!ctx) throw new Error('useDashboardPeriod must be used within PeriodProvider')
  return [ctx.dashboardPeriod, ctx.setDashboardPeriod] as const
}

export function useStatementsPeriod() {
  const ctx = useContext(PeriodContext)
  if (!ctx) throw new Error('useStatementsPeriod must be used within PeriodProvider')
  return [ctx.statementsPeriod, ctx.setStatementsPeriod] as const
}
