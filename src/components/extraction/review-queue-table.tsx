'use client'

import Link from 'next/link'
import { ClipboardCheck, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useReviewQueue } from '@/hooks/use-extraction'

export function ReviewQueueTable() {
  const { data, isLoading } = useReviewQueue()

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  if (!data?.items.length) {
    return (
      <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
        <ClipboardCheck className="w-10 h-10 mx-auto text-gray-300 mb-3" />
        <p className="text-gray-500 text-sm">No documents pending extraction review</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="text-left px-4 py-3 font-medium text-gray-600">Document</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Vendor</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Amount</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Confidence</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {data.items.map(record => {
            const confidencePct = record.confidence_score !== null
              ? Math.round(record.confidence_score * 100)
              : null
            const confidenceColor =
              confidencePct === null ? 'text-gray-400'
              : confidencePct >= 75 ? 'text-yellow-600'
              : 'text-red-600'

            return (
              <tr key={record.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900 truncate max-w-xs">
                    {record.document_id.slice(0, 8)}…
                  </p>
                  <p className="text-xs text-gray-400">
                    {record.extraction_provider ?? '—'}
                  </p>
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {record.vendor_name ?? <span className="text-gray-400 italic">Unknown</span>}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {record.transaction_date ?? '—'}
                </td>
                <td className="px-4 py-3 font-medium text-gray-900">
                  {record.amount !== null ? `$${record.amount.toFixed(2)}` : '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={`font-semibold ${confidenceColor}`}>
                    {confidencePct !== null ? `${confidencePct}%` : '—'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/documents/${record.document_id}?review=${record.id}`}>
                    <Button variant="outline" size="sm">
                      <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                      Review
                    </Button>
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
        <p className="text-sm text-gray-500">
          {data.total} record{data.total !== 1 ? 's' : ''} pending review
        </p>
      </div>
    </div>
  )
}
