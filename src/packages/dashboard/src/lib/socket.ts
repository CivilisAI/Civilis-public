'use client'

import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import type { RealtimeEvent } from './api'
import { resolveSocketUrl } from './runtime-config'

let socketInstance: Socket | null = null

function getSocket(): Socket {
  if (!socketInstance) {
    socketInstance = io(resolveSocketUrl(), {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    })
  }

  return socketInstance
}

export function useRealtimeFeed(maxEvents: number = 80) {
  const [events, setEvents] = useState<RealtimeEvent[]>([])
  const [connected, setConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    socketRef.current = getSocket()
    const socket = socketRef.current

    const handleConnect = () => setConnected(true)
    const handleDisconnect = () => setConnected(false)
    const handleEvent = (event: RealtimeEvent) => {
      setEvents((prev) => [event, ...prev].slice(0, maxEvents))
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('agent_event', handleEvent)
    setConnected(socket.connected)

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('agent_event', handleEvent)
    }
  }, [maxEvents])

  return { events, connected }
}

export function useThrottledRealtimeReload(
  trigger: string | undefined,
  reload: () => Promise<void> | void,
  throttleMs: number = 3000,
) {
  const reloadRef = useRef(reload)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inFlightRef = useRef(false)
  const pendingRef = useRef(false)
  const lastRunRef = useRef(0)

  useEffect(() => {
    reloadRef.current = reload
  }, [reload])

  useEffect(() => {
    async function run() {
      inFlightRef.current = true
      lastRunRef.current = Date.now()
      try {
        await reloadRef.current()
      } finally {
        inFlightRef.current = false
        if (pendingRef.current) {
          pendingRef.current = false
          schedule()
        }
      }
    }

    function schedule() {
      if (timerRef.current) return
      const elapsed = Date.now() - lastRunRef.current
      const wait = Math.max(0, throttleMs - elapsed)
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        if (inFlightRef.current) {
          pendingRef.current = true
          return
        }
        void run()
      }, wait)
    }

    if (!trigger) return

    const elapsed = Date.now() - lastRunRef.current
    if (!inFlightRef.current && !timerRef.current && elapsed >= throttleMs) {
      void run()
      return
    }

    pendingRef.current = true
    schedule()

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [trigger, throttleMs])
}
