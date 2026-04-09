/**
 * DB Client — single point of configuration.
 *
 * To migrate from local Supabase → cloud Supabase:
 *   Change NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   in your .env. No other code changes required.
 *
 * Server components/routes use createServerClient (cookie-based session).
 * Client components use createBrowserClient.
 */

import { createBrowserClient } from '@supabase/ssr'

/** Browser client — for use in Client Components */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. ' +
      'Copy .env.local.example to .env.local and fill in your Supabase project URL and anon key.'
    )
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
