'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { DuplicateBanner } from '@/components/shared/duplicate-banner'
import {
  LayoutDashboard,
  Upload,
  FolderOpen,
  BookOpen,
  FileText,
  Search,
  Settings,
  LogOut,
  ChevronRight,
  ClipboardCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { SessionUser } from '@/types'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/upload', label: 'Upload Files', icon: Upload },
  { href: '/documents', label: 'Documents', icon: FolderOpen },
  { href: '/extraction', label: 'Review Queue', icon: ClipboardCheck },
  { href: '/ledger', label: 'Ledger', icon: BookOpen },
  { href: '/templates', label: 'Templates', icon: FileText },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/settings', label: 'Settings', icon: Settings },
]

interface AppShellProps {
  session: SessionUser
  children: React.ReactNode
}

export function AppShell({ session, children }: AppShellProps) {
  const pathname = usePathname()

  const initials = session.profile.full_name
    ? session.profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : session.email.slice(0, 2).toUpperCase()

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <aside className="flex flex-col w-64 border-r border-gray-200 bg-white shrink-0">
        {/* Logo / Org */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-200">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-900 text-white text-xs font-bold">
            H
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {session.org?.name ?? 'Humaris'}
            </p>
            <p className="text-xs text-gray-500 capitalize">{session.role}</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
                {isActive && <ChevronRight className="w-3 h-3 ml-auto text-gray-400" />}
              </Link>
            )
          })}
        </nav>

        {/* User menu */}
        <div className="p-3 border-t border-gray-200">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors text-left outline-none">
              <Avatar className="w-7 h-7">
                <AvatarFallback className="text-xs bg-gray-200 text-gray-700">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {session.profile.full_name ?? session.email}
                </p>
                <p className="text-xs text-gray-500 truncate">{session.email}</p>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => window.location.href = '/settings'}>
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600"
                onClick={() => {
                  fetch('/api/auth/signout', { method: 'POST' }).then(() => {
                    window.location.href = '/login'
                  })
                }}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <DuplicateBanner />
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
