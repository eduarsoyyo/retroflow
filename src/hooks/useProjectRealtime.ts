// useProjectRealtime — Realtime presence + broadcast per project.
//
// Was named `useRetroRealtime` because at first it was only used inside
// the Retro tab, but the channel must stay open on any project page so
// that Seguimiento, Riesgos and Equipo also receive cross-user updates
// (see fix landed in sesión 21). The hook is now project-scoped.
//
// What it provides:
//   - `online`: presence list of users currently in the project.
//   - `cursors`: remote cursor positions (Retro only renders them, but
//     the broadcast is shared).
//   - `broadcastState(key, data)`: emit a state diff (notes, actions, ...).
//   - `broadcastPhase(p)`: emit a retro phase change.
//   - `broadcastTimer(...)`: emit timer updates (retro).
//   - `broadcastCursor(xPct, yPct)`: throttled cursor broadcast.
//
// Channel name: `project-${slug}`. The previous name (`retro-${slug}`)
// is gone — first deploy after this change forces every connected
// client to reconnect with the new name. That's a deliberate compromise
// over keeping a backwards-compatible alias: nobody loses data, only
// realtime sync until refresh.
//
// Note on `slug`: this is the project slug (e.g. "vwfs"), which on the
// Postgres side is still stored in columns named `sala` for legacy
// reasons. The DB rename is queued for the RLS migration (deuda 4).
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/data/supabase'

export interface OnlineUser {
  id: string
  name: string
  avatar: string
  color: string
}

export interface RemoteCursor {
  userId: string
  name: string
  avatar: string
  color: string
  xPct: number
  yPct: number
}

interface UseProjectRealtimeOptions {
  userId: string
  userName: string
  userAvatar: string
  userColor: string
  /** Project slug. Drives the channel name. */
  slug: string
  enabled: boolean
  onStateReceived?: (key: string, data: unknown) => void
  onPhaseReceived?: (phase: number) => void
  onTimerReceived?: (secs: number, running: boolean, startedAt: number | null) => void
}

const CURSOR_THROTTLE_MS = 50

export function useProjectRealtime({
  userId, userName, userAvatar, userColor,
  slug, enabled,
  onStateReceived, onPhaseReceived, onTimerReceived,
}: UseProjectRealtimeOptions) {
  const [online, setOnline] = useState<OnlineUser[]>([])
  const [cursors, setCursors] = useState<RemoteCursor[]>([])
  const chRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const callbackRefs = useRef({ onStateReceived, onPhaseReceived, onTimerReceived })
  callbackRefs.current = { onStateReceived, onPhaseReceived, onTimerReceived }
  const lastCursorSentAt = useRef(0)

  useEffect(() => {
    if (!enabled || !userId || !slug) return

    const ch = supabase.channel(`project-${slug}`, {
      config: { presence: { key: userId } },
    })

    // Presence
    ch.on('presence', { event: 'sync' }, () => {
      const ps = ch.presenceState()
      const users: OnlineUser[] = []
      const onlineIds = new Set<string>()
      Object.entries(ps).forEach(([key, arr]) => {
        const p = (arr as Array<Record<string, unknown>>)[0]
        if (p) {
          users.push({ id: key, name: p.name as string, avatar: p.avatar as string, color: p.color as string })
          onlineIds.add(key)
        }
      })
      setOnline(users)
      // Drop cursors of users who left presence
      setCursors(prev => prev.filter(c => onlineIds.has(c.userId)))
    })

    // State sync (notes, actions, risks, tasks, obj)
    ch.on('broadcast', { event: 'sync' }, ({ payload }) => {
      if (payload.from === userId) return
      callbackRefs.current.onStateReceived?.(payload.key, payload.data)
    })

    // Phase sync
    ch.on('broadcast', { event: 'phase' }, ({ payload }) => {
      if (payload.from === userId) return
      callbackRefs.current.onPhaseReceived?.(payload.phase)
    })

    // Timer sync
    ch.on('broadcast', { event: 'timer' }, ({ payload }) => {
      if (payload.from === userId) return
      callbackRefs.current.onTimerReceived?.(payload.secs, payload.running, payload.startedAt)
    })

    // Cursor sync (presence cursors with normalised coords)
    ch.on('broadcast', { event: 'cursor' }, ({ payload }) => {
      if (payload.from === userId) return
      setCursors(prev => {
        const others = prev.filter(c => c.userId !== payload.from)
        return [...others, {
          userId: payload.from,
          name: payload.name,
          avatar: payload.avatar,
          color: payload.color,
          xPct: payload.xPct,
          yPct: payload.yPct,
        }]
      })
    })

    // Request full state when joining (for latecomers)
    ch.on('broadcast', { event: 'req' }, ({ payload }) => {
      if (payload.from === userId) return
      // The component will handle sending state via broadcastState
    })

    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await ch.track({ name: userName, avatar: userAvatar, color: userColor })
        setTimeout(() => {
          (ch as unknown as { send: (msg: Record<string, unknown>) => void }).send({
            type: 'broadcast', event: 'req', payload: { from: userId },
          })
        }, 500)
      }
    })

    chRef.current = ch

    return () => {
      ch.unsubscribe()
      chRef.current = null
    }
  }, [enabled, userId, slug, userName, userAvatar, userColor])

  const broadcastState = useCallback((key: string, data: unknown) => {
    if (!chRef.current || !userId) return
    ;(chRef.current as unknown as { send: (msg: Record<string, unknown>) => void }).send({
      type: 'broadcast', event: 'sync', payload: { key, data, from: userId },
    })
  }, [userId])

  const broadcastPhase = useCallback((phase: number) => {
    if (!chRef.current || !userId) return
    ;(chRef.current as unknown as { send: (msg: Record<string, unknown>) => void }).send({
      type: 'broadcast', event: 'phase', payload: { phase, from: userId },
    })
  }, [userId])

  const broadcastTimer = useCallback((secs: number, running: boolean, startedAt: number | null) => {
    if (!chRef.current || !userId) return
    ;(chRef.current as unknown as { send: (msg: Record<string, unknown>) => void }).send({
      type: 'broadcast', event: 'timer', payload: { secs, running, startedAt, from: userId },
    })
  }, [userId])

  // Throttled cursor broadcast: emits at most once every CURSOR_THROTTLE_MS.
  // Coords are normalised (0..1) so receivers can map them onto their own
  // viewport sizes.
  const broadcastCursor = useCallback((xPct: number, yPct: number) => {
    if (!chRef.current || !userId) return
    const now = Date.now()
    if (now - lastCursorSentAt.current < CURSOR_THROTTLE_MS) return
    lastCursorSentAt.current = now
    ;(chRef.current as unknown as { send: (msg: Record<string, unknown>) => void }).send({
      type: 'broadcast',
      event: 'cursor',
      payload: { xPct, yPct, from: userId, name: userName, avatar: userAvatar, color: userColor },
    })
  }, [userId, userName, userAvatar, userColor])

  return { online, cursors, broadcastState, broadcastPhase, broadcastTimer, broadcastCursor }
}
