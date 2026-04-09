'use client'

import Link from 'next/link'
import { AlertCircle, X } from 'lucide-react'
import { usePendingDuplicatesCount } from '@/hooks/use-documents'

export function DuplicateBanner() {
  const { data: count } = usePendingDuplicatesCount()

  if (!count || count === 0) return null

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-yellow-50 border-b border-yellow-200">
      <AlertCircle className="w-4 h-4 text-yellow-600 shrink-0" />
      <p className="text-sm text-yellow-800 flex-1">
        <span className="font-semibold">{count} file{count > 1 ? 's' : ''} need your attention.</span>{' '}
        <Link href="/documents?folder=duplicates_review" className="underline hover:no-underline">
          View duplicates pending review
        </Link>
      </p>
    </div>
  )
}
