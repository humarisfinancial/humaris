'use client'

import { cn } from '@/lib/utils'

interface KPICardProps {
  label: string
  value: number | null
  /** 'currency' = USD integer. 'growth' = signed % e.g. "+12.3%" */
  format: 'currency' | 'growth'
  /** Optional secondary line, e.g. "Margin: 70.2%" */
  secondary?: string | null
  /** Prior-period value for MoM badge (hidden if 0 or undefined) */
  momValue?: number | null
  /** Prior-period value for YoY badge (hidden if 0 or undefined) */
  yoyValue?: number | null
  /** Invert badge colours — up is bad (used for expenses) */
  invertBadge?: boolean
}

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

function pctChange(current: number, prior: number): number {
  return prior !== 0 ? ((current - prior) / Math.abs(prior)) * 100 : 0
}

function Badge({
  pct,
  label,
  invert,
}: {
  pct: number
  label: string
  invert?: boolean
}) {
  const isPositive = invert ? pct <= 0 : pct >= 0
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium',
        isPositive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
      )}
    >
      {pct >= 0 ? '↑' : '↓'} {Math.abs(pct).toFixed(1)}% {label}
    </span>
  )
}

export function KPICard({
  label,
  value,
  format,
  secondary,
  momValue,
  yoyValue,
  invertBadge,
}: KPICardProps) {
  const displayValue =
    value === null || value === undefined
      ? '—'
      : format === 'currency'
        ? USD.format(value)
        : `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`

  const showMom = typeof momValue === 'number' && momValue !== 0 && value !== null
  const showYoy = typeof yoyValue === 'number' && yoyValue !== 0 && value !== null

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">{label}</p>
      <p
        className="text-2xl font-bold text-gray-900"
        style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif' }}
      >
        {displayValue}
      </p>
      {secondary && <p className="text-xs text-gray-400">{secondary}</p>}
      {(showMom || showYoy) && (
        <div className="flex flex-wrap gap-1.5">
          {showMom && (
            <Badge
              pct={pctChange(value!, momValue!)}
              label="MoM"
              invert={invertBadge}
            />
          )}
          {showYoy && (
            <Badge
              pct={pctChange(value!, yoyValue!)}
              label="YoY"
              invert={invertBadge}
            />
          )}
        </div>
      )}
      {showMom && (
        <p className="text-xs text-gray-400">vs {USD.format(momValue!)} prev period</p>
      )}
    </div>
  )
}
