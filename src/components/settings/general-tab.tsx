'use client'

import { useState } from 'react'
import { useUpdateOrg } from '@/hooks/use-settings'

interface GeneralTabProps {
  orgName: string
}

export function GeneralTab({ orgName }: GeneralTabProps) {
  const [name, setName] = useState(orgName)
  const [saved, setSaved] = useState(false)
  const { mutate, isPending, error } = useUpdateOrg()

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaved(false)
    mutate(name, {
      onSuccess: () => setSaved(true),
    })
  }

  return (
    <div className="max-w-md space-y-6">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Organization</h2>
        <p className="text-sm text-gray-500 mt-0.5">Update your organization's display name.</p>
      </div>
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label htmlFor="org-name" className="block text-sm font-medium text-gray-700 mb-1">
            Organization name
          </label>
          <input
            id="org-name"
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); setSaved(false) }}
            maxLength={100}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
        </div>
        {error && (
          <p className="text-sm text-red-600">{error.message}</p>
        )}
        {saved && (
          <p className="text-sm text-green-600">Saved.</p>
        )}
        <button
          type="submit"
          disabled={isPending || !name.trim()}
          className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? 'Saving…' : 'Save'}
        </button>
      </form>
    </div>
  )
}
