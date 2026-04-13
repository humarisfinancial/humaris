'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { GeneralTab } from './general-tab'
import { TeamTab } from './team-tab'
import type { OrgRole } from '@/types'

interface SettingsShellProps {
  orgName: string
  userId: string
  userRole: OrgRole
  initialTab: 'general' | 'team'
}

export function SettingsShell({ orgName, userId, userRole, initialTab }: SettingsShellProps) {
  const [tab, setTab] = useState<'general' | 'team'>(initialTab)
  const router = useRouter()

  function handleTabChange(newTab: 'general' | 'team') {
    setTab(newTab)
    router.replace(`/settings?tab=${newTab}`, { scroll: false })
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1
          className="text-2xl font-bold text-gray-900"
          style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif' }}
        >
          Settings
        </h1>
        <p className="text-gray-500 mt-1 text-sm">{orgName}</p>
      </div>

      <div className="flex gap-1 mb-8 border-b border-gray-200">
        {(['general', 'team'] as const).map(t => (
          <button
            key={t}
            onClick={() => handleTabChange(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'general' && <GeneralTab orgName={orgName} />}
      {tab === 'team' && <TeamTab currentUserId={userId} currentUserRole={userRole} />}
    </div>
  )
}
