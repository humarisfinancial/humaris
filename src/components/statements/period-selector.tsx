'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getMTD, getQTD, getYTD, type StatementPeriod } from '@/hooks/use-statements'

type Preset = 'MTD' | 'QTD' | 'YTD' | 'custom'

interface PeriodSelectorProps {
  value: StatementPeriod | null
  onChange: (period: StatementPeriod) => void
}

function detectPreset(value: StatementPeriod | null): Preset {
  if (!value) return 'MTD'
  const mtd = getMTD(); const qtd = getQTD(); const ytd = getYTD()
  if (value.from === mtd.from && value.to === mtd.to) return 'MTD'
  if (value.from === qtd.from && value.to === qtd.to) return 'QTD'
  if (value.from === ytd.from && value.to === ytd.to) return 'YTD'
  return 'custom'
}

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  const [preset, setPreset] = useState<Preset>(() => detectPreset(value))
  const [customFrom, setCustomFrom] = useState(() => value?.from ?? '')
  const [customTo, setCustomTo] = useState(() => value?.to ?? '')

  // Sync internal state when parent restores a saved period (e.g. from localStorage)
  useEffect(() => {
    if (!value) return
    const p = detectPreset(value)
    setPreset(p)
    if (p === 'custom') {
      setCustomFrom(value.from)
      setCustomTo(value.to)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.from, value?.to])

  function selectPreset(p: Preset) {
    setPreset(p)
    if (p === 'MTD') onChange(getMTD())
    else if (p === 'QTD') onChange(getQTD())
    else if (p === 'YTD') onChange(getYTD())
  }

  function handleCustomFromChange(val: string) {
    setCustomFrom(val)
    if (val && customTo) onChange({ from: val, to: customTo })
  }

  function handleCustomToChange(val: string) {
    setCustomTo(val)
    if (customFrom && val) onChange({ from: customFrom, to: val })
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-1">
        {(['MTD', 'QTD', 'YTD'] as const).map(p => (
          <button
            key={p}
            onClick={() => selectPreset(p)}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-medium transition-all',
              preset === p
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {p}
          </button>
        ))}
        <button
          onClick={() => setPreset('custom')}
          className={cn(
            'px-3 py-1.5 rounded-md text-sm font-medium transition-all',
            preset === 'custom'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          )}
        >
          Custom
        </button>
      </div>

      {preset === 'custom' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customFrom}
            onChange={e => handleCustomFromChange(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1"
          />
          <span className="text-gray-400 text-sm">–</span>
          <input
            type="date"
            value={customTo}
            onChange={e => handleCustomToChange(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1"
          />
        </div>
      )}

      {value && (
        <span className="text-xs text-gray-400">
          {new Date(value.from).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          {' – '}
          {new Date(value.to).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
      )}
    </div>
  )
}
