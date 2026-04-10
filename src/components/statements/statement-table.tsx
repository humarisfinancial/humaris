'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { StatementData, StatementSection } from '@/types'

interface StatementTableProps {
  data: StatementData
  generatedAt: string
}

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export function StatementTable({ data, generatedAt }: StatementTableProps) {
  const uncategorized = (data.metadata.uncategorized_entries ?? []) as {
    id: string
    description: string | null
    entry_date: string
    amount: number
    account_name: string
  }[]

  return (
    <div className="space-y-1">
      {data.sections.map(section => (
        <Section key={section.label} section={section} depth={0} />
      ))}

      {uncategorized.length > 0 && (
        <div className="mt-6 border border-amber-200 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 bg-amber-50">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="text-sm font-semibold text-amber-800">
              Uncategorized ({uncategorized.length})
            </span>
            <span className="text-sm text-amber-600 ml-auto">
              {USD.format(uncategorized.reduce((s, e) => s + e.amount, 0))}
            </span>
          </div>
          <div className="divide-y divide-amber-100">
            {uncategorized.map(e => (
              <div key={e.id} className="flex items-center justify-between px-5 py-2.5 bg-white hover:bg-amber-50/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 truncate">
                    {e.description ?? `Entry ${e.id.slice(0, 8)}`}
                  </p>
                  <p className="text-xs text-gray-400">
                    {e.account_name} · {e.entry_date}
                  </p>
                </div>
                <div className="flex items-center gap-4 shrink-0 ml-4">
                  <span className="text-sm tabular-nums text-gray-700">
                    {USD.format(e.amount)}
                  </span>
                  <Link
                    href={`/ledger?entry=${e.id}`}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700 underline-offset-2 hover:underline"
                  >
                    Categorize
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 pt-4 text-right">
        Last generated {new Date(generatedAt).toLocaleString()}
      </p>
    </div>
  )
}

function Section({ section, depth }: { section: StatementSection; depth: number }) {
  const [open, setOpen] = useState(false)
  const hasChildren = (section.children?.length ?? 0) > 0
  const isEntry = !!section.entry_id

  const isTotal =
    section.label.startsWith('NET') ||
    section.label.startsWith('TOTAL') ||
    section.label.startsWith('GROSS')

  if (isTotal) {
    return (
      <div className="flex items-center justify-between px-5 py-3 border-t-2 border-gray-900 mt-2">
        <span className="text-sm font-bold text-gray-900 uppercase tracking-wide">
          {section.label}
        </span>
        <span className={cn('text-sm font-bold tabular-nums', section.amount < 0 ? 'text-red-600' : 'text-gray-900')}>
          {USD.format(section.amount)}
        </span>
      </div>
    )
  }

  if (depth === 0) {
    return (
      <div className="pt-4">
        <div
          onClick={() => hasChildren && setOpen(o => !o)}
          className={cn(
            'flex items-center justify-between px-5 py-2',
            hasChildren && 'cursor-pointer group'
          )}
        >
          <div className="flex items-center gap-2">
            {hasChildren && (
              <ChevronRight
                className={cn('w-3.5 h-3.5 text-gray-400 transition-transform shrink-0', open && 'rotate-90')}
              />
            )}
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
              {section.label}
            </span>
          </div>
          <span className="text-sm font-semibold tabular-nums text-gray-700">
            {USD.format(section.amount)}
          </span>
        </div>
        {open && section.children && (
          <div className="pb-2">
            {section.children.map(c => (
              <Section key={c.label + (c.entry_id ?? '')} section={c} depth={depth + 1} />
            ))}
          </div>
        )}
        {!hasChildren && (
          <div className="h-px bg-gray-100 mx-5 mt-1" />
        )}
      </div>
    )
  }

  if (isEntry) {
    return (
      <div className="flex items-center justify-between px-5 py-2 hover:bg-gray-50 transition-colors" style={{ paddingLeft: `${depth * 20 + 20}px` }}>
        <div className="flex-1 min-w-0">
          <span className="text-sm text-gray-600 truncate block">{section.label}</span>
          {section.entry_date && (
            <span className="text-xs text-gray-400">{section.entry_date}</span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-4">
          <span className="text-sm tabular-nums text-gray-600">{USD.format(section.amount)}</span>
          {section.source_doc_id && (
            <Link
              href={`/documents/${section.source_doc_id}`}
              className="text-xs text-blue-500 hover:text-blue-600"
            >
              View doc
            </Link>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div
        onClick={() => hasChildren && setOpen(o => !o)}
        className={cn(
          'flex items-center justify-between px-5 py-2.5 hover:bg-gray-50 transition-colors',
          hasChildren && 'cursor-pointer'
        )}
        style={{ paddingLeft: `${depth * 20 + 20}px` }}
      >
        <div className="flex items-center gap-2">
          {hasChildren && (
            <ChevronRight
              className={cn('w-3 h-3 text-gray-400 transition-transform shrink-0', open && 'rotate-90')}
            />
          )}
          <span className="text-sm text-gray-700">{section.label}</span>
          {section.code && <span className="text-xs text-gray-400">{section.code}</span>}
        </div>
        <span className="text-sm tabular-nums text-gray-700">{USD.format(section.amount)}</span>
      </div>
      {open && section.children && section.children.map(c => (
        <Section key={c.label + (c.entry_id ?? '')} section={c} depth={depth + 1} />
      ))}
    </div>
  )
}
