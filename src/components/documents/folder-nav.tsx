'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { FolderOpen, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePendingDuplicatesCount } from '@/hooks/use-documents'
import type { DocumentFolder } from '@/types'

const FOLDERS: { value: DocumentFolder | 'all'; label: string }[] = [
  { value: 'all', label: 'All Documents' },
  { value: 'invoices', label: 'Invoices' },
  { value: 'expenses', label: 'Expenses' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'bank_statements', label: 'Bank Statements' },
  { value: 'payroll', label: 'Payroll' },
  { value: 'finance_accounting', label: 'Finance & Accounting' },
  { value: 'original_uploads', label: 'Original Uploads' },
]

export function FolderNav() {
  const searchParams = useSearchParams()
  const currentFolder = searchParams.get('folder') ?? 'all'
  const { data: duplicateCount } = usePendingDuplicatesCount()

  return (
    <nav className="space-y-1">
      {FOLDERS.map(({ value, label }) => {
        const href = value === 'all' ? '/documents' : `/documents?folder=${value}`
        const isActive = currentFolder === value

        return (
          <Link
            key={value}
            href={href}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
              isActive
                ? 'bg-gray-100 text-gray-900 font-medium'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            )}
          >
            <FolderOpen className="w-4 h-4 shrink-0" />
            {label}
          </Link>
        )
      })}

      {/* Duplicates folder — only shown when there are pending items */}
      {(duplicateCount ?? 0) > 0 && (
        <Link
          href="/documents?folder=duplicates_review"
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
            currentFolder === 'duplicates_review'
              ? 'bg-yellow-100 text-yellow-900 font-medium'
              : 'text-yellow-700 hover:bg-yellow-50'
          )}
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          Duplicates — Needs Review
          <span className="ml-auto text-xs font-semibold bg-yellow-200 text-yellow-800 rounded-full px-1.5 py-0.5">
            {duplicateCount}
          </span>
        </Link>
      )}
    </nav>
  )
}
