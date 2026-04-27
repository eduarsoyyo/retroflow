import { supabase } from '@/data/supabase'

/** Fire-and-forget event logging */
export function trackEvent(userId: string, event: string, metadata?: Record<string, unknown>) {
  if (!userId) return
  supabase.from('usage_log').insert({ user_id: userId, event, metadata: metadata || {} })
    .then(({ error }) => { if (error) console.warn('[revelio] usage track error:', error.message) })
}

/** Track page view with session duration */
let sessionStart = Date.now()

export function trackPageView(userId: string, page: string) {
  trackEvent(userId, 'page_view', { page })
}

export function trackLogin(userId: string) {
  sessionStart = Date.now()
  trackEvent(userId, 'login')
}

export function trackSessionEnd(userId: string) {
  const duration = Math.round((Date.now() - sessionStart) / 1000)
  trackEvent(userId, 'session_end', { duration_seconds: duration })
}

/** Compute engagement metrics from usage_log */
export interface EngagementMetrics {
  dailyActiveUsers: Array<{ date: string; count: number }>
  avgSessionMinutes: number
  totalSessions: number
  topUsers: Array<{ name: string; sessions: number; avatar?: string }>
  eventsToday: number
  eventsTrend: number // % vs yesterday
}

export async function getEngagementMetrics(days = 30): Promise<EngagementMetrics> {
  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceStr = since.toISOString()

  const { data: logs } = await supabase
    .from('usage_log')
    .select('user_id, event, metadata, created_at')
    .gte('created_at', sinceStr)
    .order('created_at', { ascending: false })

  const { data: members } = await supabase.from('team_members').select('id, name, avatar')

  const entries = (logs || []) as Array<{ user_id: string; event: string; metadata: Record<string, unknown>; created_at: string }>
  const memberMap = new Map((members || []).map((m: { id: string; name: string; avatar?: string }) => [m.id, m]))

  // Daily active users
  const dailyMap: Record<string, Set<string>> = {}
  entries.forEach(e => {
    const day = e.created_at.slice(0, 10)
    if (!dailyMap[day]) dailyMap[day] = new Set()
    dailyMap[day]!.add(e.user_id)
  })
  const dailyActiveUsers = Object.entries(dailyMap)
    .map(([date, users]) => ({ date, count: users.size }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-days)

  // Average session duration
  const sessions = entries.filter(e => e.event === 'session_end')
  const avgSessionMinutes = sessions.length > 0
    ? Math.round(sessions.reduce((s, e) => s + (Number(e.metadata?.duration_seconds) || 0), 0) / sessions.length / 60)
    : 0

  const totalSessions = entries.filter(e => e.event === 'login').length

  // Top users by sessions
  const userSessions: Record<string, number> = {}
  entries.filter(e => e.event === 'login').forEach(e => { userSessions[e.user_id] = (userSessions[e.user_id] || 0) + 1 })
  const topUsers = Object.entries(userSessions)
    .map(([uid, count]) => {
      const m = memberMap.get(uid) as { name: string; avatar?: string } | undefined
      return { name: m?.name || 'Desconocido', sessions: count, avatar: m?.avatar }
    })
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 5)

  // Events today vs yesterday
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  const eventsToday = entries.filter(e => e.created_at.startsWith(today)).length
  const eventsYesterday = entries.filter(e => e.created_at.startsWith(yesterday)).length
  const eventsTrend = eventsYesterday > 0 ? Math.round(((eventsToday - eventsYesterday) / eventsYesterday) * 100) : 0

  return { dailyActiveUsers, avgSessionMinutes, totalSessions, topUsers, eventsToday, eventsTrend }
}
