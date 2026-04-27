import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { supabase } from '@/data/supabase'

type ThemeMode = 'light' | 'dark' | 'auto' | 'schedule'

interface ThemeSchedule { darkFrom: string; darkTo: string }

interface ThemeState {
  mode: ThemeMode
  isDark: boolean
  schedule: ThemeSchedule
  setMode: (mode: ThemeMode) => void
  setSchedule: (s: ThemeSchedule) => void
  toggle: () => void
  setUserId: (id: string | null) => void
}

const ThemeContext = createContext<ThemeState | null>(null)
const DEFAULT_SCHEDULE: ThemeSchedule = { darkFrom: '20:00', darkTo: '07:00' }

function getSystemDark() { return window.matchMedia('(prefers-color-scheme: dark)').matches }

function isInSchedule(schedule: ThemeSchedule): boolean {
  const now = new Date()
  const current = now.getHours() * 60 + now.getMinutes()
  const [fh, fm] = schedule.darkFrom.split(':').map(Number)
  const [th, tm] = schedule.darkTo.split(':').map(Number)
  const from = (fh ?? 20) * 60 + (fm ?? 0)
  const to = (th ?? 7) * 60 + (tm ?? 0)
  if (from > to) return current >= from || current < to
  return current >= from && current < to
}

function resolveIsDark(mode: ThemeMode, schedule: ThemeSchedule): boolean {
  if (mode === 'dark') return true
  if (mode === 'light') return false
  if (mode === 'schedule') return isInSchedule(schedule)
  return getSystemDark()
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null)
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem('revelio-theme') as ThemeMode | null
    return ['dark', 'light', 'auto', 'schedule'].includes(stored || '') ? stored! : 'light'
  })
  const [schedule, setScheduleState] = useState<ThemeSchedule>(() => {
    try { return JSON.parse(localStorage.getItem('revelio-theme-schedule') || 'null') || DEFAULT_SCHEDULE } catch { return DEFAULT_SCHEDULE }
  })
  const [isDark, setIsDark] = useState(() => resolveIsDark(mode, schedule))
  const [loaded, setLoaded] = useState(false)

  // Load preferences from Supabase when userId is set
  useEffect(() => {
    if (!userId) { setLoaded(true); return }
    supabase.from('team_members').select('preferences').eq('id', userId).single().then(({ data }) => {
      if (data?.preferences) {
        const prefs = data.preferences as Record<string, unknown>
        if (prefs.theme && ['dark', 'light', 'auto', 'schedule'].includes(prefs.theme as string)) {
          setModeState(prefs.theme as ThemeMode)
        }
        if (prefs.themeSchedule) {
          const s = prefs.themeSchedule as ThemeSchedule
          if (s.darkFrom && s.darkTo) setScheduleState(s)
        }
      }
      setLoaded(true)
    })
  }, [userId])

  // Apply dark class
  useEffect(() => {
    if (!loaded) return
    const dark = resolveIsDark(mode, schedule)
    setIsDark(dark)
    document.documentElement.classList.toggle('dark', dark)
  }, [mode, schedule, loaded])

  // Re-check schedule every minute
  useEffect(() => {
    if (mode !== 'schedule') return
    const iv = setInterval(() => {
      const dark = isInSchedule(schedule)
      setIsDark(dark)
      document.documentElement.classList.toggle('dark', dark)
    }, 60000)
    return () => clearInterval(iv)
  }, [mode, schedule])

  // Listen for system preference changes in auto mode
  useEffect(() => {
    if (mode !== 'auto') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => { setIsDark(e.matches); document.documentElement.classList.toggle('dark', e.matches) }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [mode])

  // Save to Supabase + localStorage
  const persistPrefs = useCallback((m: ThemeMode, s: ThemeSchedule) => {
    localStorage.setItem('revelio-theme', m)
    localStorage.setItem('revelio-theme-schedule', JSON.stringify(s))
    if (userId) {
      supabase.from('team_members').select('preferences').eq('id', userId).single().then(({ data }) => {
        const existing = (data?.preferences || {}) as Record<string, unknown>
        void supabase.from('team_members').update({ preferences: { ...existing, theme: m, themeSchedule: s } }).eq('id', userId)
      })
    }
  }, [userId])

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m)
    persistPrefs(m, schedule)
  }, [schedule, persistPrefs])

  const setSchedule = useCallback((s: ThemeSchedule) => {
    setScheduleState(s)
    persistPrefs(mode, s)
  }, [mode, persistPrefs])

  const toggle = useCallback(() => {
    setMode(isDark ? 'light' : 'dark')
  }, [isDark, setMode])

  return (
    <ThemeContext.Provider value={{ mode, isDark, schedule, setMode, setSchedule, toggle, setUserId }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
