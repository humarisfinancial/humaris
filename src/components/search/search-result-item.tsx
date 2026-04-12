'use client'

import { FileText, ArrowLeftRight, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SearchResult } from '@/lib/search'

const ICONS: Record<SearchResult['type'], React.ElementType> = {
  document: FileText,
  transaction: ArrowLeftRight,
  vendor: Building2,
}

const TYPE_LABELS: Record<SearchResult['type'], string> = {
  document: 'Doc',
  transaction: 'Txn',
  vendor: 'Vendor',
}

interface SearchResultItemProps {
  result: SearchResult
  isFocused: boolean
  onClick: () => void
}

export function SearchResultItem({ result, isFocused, onClick }: SearchResultItemProps) {
  const Icon = ICONS[result.type]
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
        isFocused ? 'bg-gray-50' : 'hover:bg-gray-50'
      )}
    >
      <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
        <Icon className="w-3.5 h-3.5 text-gray-600" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900 truncate">{result.title}</p>
        <p className="text-xs text-gray-400 truncate">{result.subtitle}</p>
      </div>
      <span className="flex-shrink-0 text-xs text-gray-300 font-mono">{TYPE_LABELS[result.type]}</span>
    </button>
  )
}
