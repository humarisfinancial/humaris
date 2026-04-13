'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type State = 'loading' | 'success' | 'expired' | 'used' | 'invalid' | 'error'

export default function InviteAcceptPage() {
  const [state, setState] = useState<State>('loading')
  const router = useRouter()

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token')
    if (!token) {
      setState('invalid')
      return
    }

    fetch('/api/invite/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async r => {
        const body = await r.json()
        if (r.ok) {
          setState('success')
          setTimeout(() => router.replace('/dashboard'), 1500)
        } else {
          const err = body.error as string
          if (err === 'TOKEN_EXPIRED') setState('expired')
          else if (err === 'TOKEN_USED') setState('used')
          else setState('invalid')
        }
      })
      .catch(() => setState('error'))
  }, [router])

  const messages: Record<State, { heading: string; body: string }> = {
    loading: { heading: 'Accepting your invitation…', body: 'Please wait.' },
    success: { heading: 'Welcome!', body: 'Invitation accepted. Redirecting you to the dashboard…' },
    expired: { heading: 'Invitation expired', body: 'This invitation has expired. Ask your team admin to send a new one.' },
    used: { heading: 'Already accepted', body: 'This invitation has already been accepted. Try signing in.' },
    invalid: { heading: 'Invalid link', body: 'This invitation link is not valid.' },
    error: { heading: 'Something went wrong', body: 'Unable to accept the invitation. Please try again.' },
  }

  const { heading, body } = messages[state]

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-sm w-full text-center space-y-3">
        {state === 'loading' && (
          <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        )}
        <h1
          className="text-lg font-semibold text-gray-900"
          style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif' }}
        >
          {heading}
        </h1>
        <p className="text-sm text-gray-500">{body}</p>
        {(state === 'expired' || state === 'used' || state === 'invalid') && (
          <a
            href="/login"
            className="inline-block mt-4 text-sm font-medium text-gray-900 underline"
          >
            Go to sign in
          </a>
        )}
      </div>
    </div>
  )
}
