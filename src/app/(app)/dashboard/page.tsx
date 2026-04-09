import { requireSession } from '@/lib/auth/session'

export default async function DashboardPage() {
  const session = await requireSession()

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">
          Welcome back, {session.profile.full_name ?? session.email}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {['Total Revenue', 'Gross Profit', 'Total Expenses', 'Net Cash Flow'].map(metric => (
          <div key={metric} className="bg-white rounded-xl border border-gray-200 p-6">
            <p className="text-sm font-medium text-gray-500">{metric}</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">—</p>
            <p className="mt-1 text-xs text-gray-400">Upload documents to populate</p>
          </div>
        ))}
      </div>

      <div className="mt-8 bg-white rounded-xl border border-gray-200 p-8 text-center">
        <p className="text-gray-500 text-sm">
          Upload your first financial documents to start seeing your KPI dashboard.
        </p>
        <a
          href="/upload"
          className="mt-4 inline-flex items-center px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
        >
          Upload Files
        </a>
      </div>
    </div>
  )
}
