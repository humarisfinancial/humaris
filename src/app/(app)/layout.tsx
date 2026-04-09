import { requireSession } from '@/lib/auth/session'
import { AppShell } from '@/components/layout/app-shell'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession()

  return <AppShell session={session}>{children}</AppShell>
}
