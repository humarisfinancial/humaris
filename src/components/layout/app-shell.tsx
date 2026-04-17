'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { DuplicateBanner } from '@/components/shared/duplicate-banner'
import {
  LayoutDashboard,
  Upload,
  FolderOpen,
  BookOpen,
  BarChart3,
  FileText,
  Search,
  Settings,
  LogOut,
  ChevronRight,
  ClipboardCheck,
  RefreshCw,
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
import { SearchOverlay } from '@/components/search/search-overlay'

const NAV_ITEMS: { href: string; label: string; icon: React.ElementType; hint?: string }[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/upload', label: 'Upload Files', icon: Upload },
  { href: '/documents', label: 'Documents', icon: FolderOpen },
  { href: '/extraction', label: 'Review Queue', icon: ClipboardCheck },
  { href: '/ledger', label: 'Ledger', icon: BookOpen },
  { href: '/statements', label: 'Statements', icon: BarChart3 },
  { href: '/templates', label: 'Templates', icon: FileText },
  { href: '/search', label: 'Search', icon: Search, hint: '⌘K' },
  { href: '/settings', label: 'Settings', icon: Settings },
]

const DEFAULT_WIDTH = 256
const MIN_WIDTH = 52     // icon-only
const MAX_WIDTH = 400
const ICON_THRESHOLD = 120  // below this → icon-only mode

interface AppShellProps {
  session: SessionUser
  children: React.ReactNode
}

export function AppShell({ session, children }: AppShellProps) {
  const pathname = usePathname()
  const queryClient = useQueryClient()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH)

  async function handleRefresh() {
    setIsRefreshing(true)
    await queryClient.invalidateQueries()
    // Brief visual feedback so the spin is always visible
    setTimeout(() => setIsRefreshing(false), 600)
  }

  // Restore saved width after mount (avoids SSR mismatch)
  useEffect(() => {
    const saved = localStorage.getItem('sidebar:width')
    if (saved) setSidebarWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Number(saved))))
  }, [])

  const isIconOnly = sidebarWidth <= ICON_THRESHOLD

  // Drag-to-resize state
  const isDragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    startX.current = e.clientX
    startWidth.current = sidebarWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [sidebarWidth])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      const delta = e.clientX - startX.current
      const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth.current + delta))
      setSidebarWidth(newWidth)
    }
    const onUp = () => {
      if (!isDragging.current) return
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      // Persist after drag ends
      setSidebarWidth(prev => {
        localStorage.setItem('sidebar:width', String(prev))
        return prev
      })
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  const initials = session.profile.full_name
    ? session.profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : session.email.slice(0, 2).toUpperCase()

  const userMenuItems = (
    <>
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
    </>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <aside
        style={{ width: sidebarWidth }}
        className="relative flex flex-col border-r border-gray-200 bg-white shrink-0"
      >
        {/* Logo / Org */}
        <div className={cn(
          'flex items-center gap-3 border-b border-gray-200 transition-all',
          isIconOnly ? 'px-0 py-5 justify-center' : 'px-6 py-5'
        )}>
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-900 text-white text-xs font-bold shrink-0">
            H
          </div>
          {!isIconOnly && (
            <div className="min-w-0 overflow-hidden">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {session.org?.name ?? 'Humaris'}
              </p>
              <p className="text-xs text-gray-500 capitalize">{session.role}</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className={cn('flex-1 py-4 space-y-1 overflow-y-auto', isIconOnly ? 'px-1.5' : 'px-3')}>
          {NAV_ITEMS.map(({ href, label, icon: Icon, hint }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                title={isIconOnly ? label : undefined}
                className={cn(
                  'flex items-center rounded-lg text-sm font-medium transition-colors',
                  isIconOnly
                    ? 'justify-center p-2'
                    : 'gap-3 px-3 py-2',
                  isActive
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!isIconOnly && (
                  <>
                    <span className="flex-1 truncate">{label}</span>
                    {hint && !isActive && (
                      <span className="text-[10px] text-gray-400 font-mono">{hint}</span>
                    )}
                    {isActive && <ChevronRight className="w-3 h-3 text-gray-400 shrink-0" />}
                  </>
                )}
              </Link>
            )
          })}
        </nav>

        {/* User menu */}
        <div className={cn('border-t border-gray-200', isIconOnly ? 'p-1.5' : 'p-3')}>
          <DropdownMenu>
            <DropdownMenuTrigger className={cn(
              'flex items-center w-full rounded-lg text-sm hover:bg-gray-50 transition-colors outline-none',
              isIconOnly ? 'justify-center p-2' : 'gap-3 px-3 py-2 text-left'
            )}>
              <Avatar className="w-7 h-7 shrink-0">
                <AvatarFallback className="text-xs bg-gray-200 text-gray-700">
                  {initials}
                </AvatarFallback>
              </Avatar>
              {!isIconOnly && (
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {session.profile.full_name ?? session.email}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{session.email}</p>
                </div>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {userMenuItems}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Drag handle */}
        <div
          onMouseDown={handleDragStart}
          onDoubleClick={() => {
            setSidebarWidth(DEFAULT_WIDTH)
            localStorage.setItem('sidebar:width', String(DEFAULT_WIDTH))
          }}
          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize z-10
                     hover:bg-blue-400/40 active:bg-blue-500/50 transition-colors"
          title="Drag to resize · Double-click to reset"
        />
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <DuplicateBanner />
        {/* Top bar with refresh */}
        <div className="flex items-center justify-end px-4 py-1.5 border-b border-gray-100 bg-white shrink-0">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Refresh page data"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isRefreshing && 'animate-spin')} />
            <span>Refresh</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
        <SearchOverlay />
      </main>
    </div>
  )
}
