import { requireSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'

export default async function AdminTenantsPage() {
  const session = await requireSession()

  if (!session.is_super_admin) {
    redirect('/dashboard')
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900">Tenant Management</h1>
      <p className="text-gray-500 mt-1">Super admin — all organizations — Sprint 8</p>
    </div>
  )
}
