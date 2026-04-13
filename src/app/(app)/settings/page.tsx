import { redirect } from 'next/navigation'
import { requireSession } from '@/lib/auth/session'
import { SettingsShell } from '@/components/settings/settings-shell'

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const session = await requireSession()

  if (!session.org) redirect('/dashboard')

  const role = session.role
  const isAdmin = role === 'owner' || role === 'admin'
  if (!isAdmin) redirect('/dashboard')

  const { tab } = await searchParams
  const activeTab = tab === 'team' ? 'team' : 'general'

  return (
    <SettingsShell
      orgName={session.org.name}
      userId={session.id}
      userRole={session.role}
      initialTab={activeTab}
    />
  )
}
