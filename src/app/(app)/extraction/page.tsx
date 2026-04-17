import { ReviewQueueTable } from '@/components/extraction/review-queue-table'
import { requireSession } from '@/lib/auth/session'
import { permissions } from '@/lib/rbac/permissions'
import { redirect } from 'next/navigation'

export default async function ExtractionPage() {
  const session = await requireSession()

  if (!permissions.extraction.review(session.role)) {
    redirect('/dashboard')
  }

  return (
    <div className="w-full px-3 sm:px-5 lg:px-8 py-4 sm:py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Extraction Review Queue</h1>
        <p className="text-gray-500 mt-1">
          Documents where AI confidence was below 75% — review and approve extracted data
        </p>
      </div>
      <ReviewQueueTable />
    </div>
  )
}
