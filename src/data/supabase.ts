import { createClient } from '@supabase/supabase-js'
import { ENV } from '@/lib/env'

// Custom lock that avoids NavigatorLock issues in production builds
const locks = new Map<string, Promise<unknown>>()
const customLock = async <T>(name: string, _acquireTimeout: number, fn: (lock: unknown) => Promise<T>): Promise<T> => {
  const existing = locks.get(name)
  if (existing) await existing.catch(() => {})
  const promise = fn(true)
  locks.set(name, promise)
  try { return await promise } finally { locks.delete(name) }
}

export const supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    storageKey: 'revelio-auth',
    detectSessionInUrl: false,
    lock: customLock,
  },
})
