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

interface UseRetroRealtimeOptions {
  userId: string
  userName: string
  userAvatar: string
  userColor: string
  sala: string
  enabled: boolean
  onStateReceived?: (key: string, data: unknown) => void
  onPhaseReceived?: (phase: number) => void
  onTimerReceived?: (secs: number, running: boolean, startedAt: number | null) => void
}

const CURSOR_THROTTLE_MS = 50

export function useRetroRealtime({
  userId, userName, userAvatar, userColor,
  sala, enabled,
  onStateReceived, onPhaseReceived, onTimerReceived,
}: UseRetroRealtimeOptions) {
  const [online, setOnline] = useState<OnlineUser[]>([])
  const [cursors, setCursors] = useState<RemoteCursor[]>([])
  const chRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const callbackRefs = useRef({ onStateReceived, onPhaseReceived, onTimerReceived })
  callbackRefs.current = { onStateReceived, onPhaseReceived, onTimerReceived }
  const lastCursorSentAt = useRef(0)

  useEffect(() => {
    if (!enabled || !userId || !sala) return

    const ch = supabase.channel(`retro-${sala}`, {
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
  }, [enabled, userId, sala, userName, userAvatar, userColor])

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
