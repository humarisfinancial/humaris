'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/db/client'
import type { User } from '@supabase/supabase-js'

/**
 * Client-side hook to access the current Supabase auth user.
 * For full SessionUser (with org/role), use the server-side requireSession().
 */
export function useAuthUser() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  return { user, loading }
}
