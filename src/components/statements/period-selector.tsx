'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getMTD, getQTD, getYTD, type StatementPeriod } from '@/hooks/use-statements'

type Preset = 'MTD' | 'QTD' | 'YTD' | 'custom'

interface PeriodSelectorProps {
  value: StatementPeriod | null
  onChange: (period: StatementPeriod) => void
}

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  const [preset, setPreset] = useState<Preset>('MTD')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  function selectPreset(p: Preset) {
    setPreset(p)
    if (p === 'MTD') onChange(getMTD())
    else if (p === 'QTD') onChange(getQTD())
    else if (p === 'YTD') onChange(getYTD())
  }

  function applyCustom() {
    if (customFrom && customTo) onChange({ from: customFrom, to: customTo })
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
            onChange={e => setCustomFrom(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1"
          />
          <span className="text-gray-400 text-sm">–</span>
          <input
            type="date"
            value={customTo}
            onChange={e => setCustomTo(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1"
          />
          <Button size="sm" variant="outline" onClick={applyCustom} disabled={!customFrom || !customTo}>
            Apply
          </Button>
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
