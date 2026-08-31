import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let singleton: SupabaseClient | null = null

export function hasSupabaseConfig(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  )
}

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (!hasSupabaseConfig()) return null
  if (!singleton) {
    singleton = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
    )
  }
  return singleton
}
