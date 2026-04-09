/**
 * Server-side Supabase client — for use in Server Components, Route Handlers,
 * and Middleware. Reads/writes cookies to maintain the user session.
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Cookies can only be set in Server Actions or Route Handlers.
            // Safe to ignore in read-only Server Components.
          }
        },
      },
    }
  )
}

/** Service role client — bypasses RLS. Super-admin and server-side ops ONLY. */
export function createServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set. Required for service-level operations.')
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    {
      cookies: { getAll: () => [], setAll: () => {} },
      auth: { persistSession: false },
    }
  )
}
