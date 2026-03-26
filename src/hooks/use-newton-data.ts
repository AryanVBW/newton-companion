import { useState, useEffect, useCallback, useRef } from 'react'
import { invoke } from '@/lib/tauri'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

export interface NewtonData {
  courses: any | null
  userProfile: any | null
  courseOverview: any | null
  upcomingSchedule: any | null
  recentLectures: any | null
  assignments: any | null
  leaderboard: any | null
  qotd: any | null
  arenaStats: any | null
  calendar: any | null
  allData: Record<string, any>
  loading: boolean
  syncing: boolean
  syncProgress: { step: string; tool?: string; done: number; total: number } | null
  error: string | null
  connected: boolean
  lastSyncedAt: string | null
  refresh: () => Promise<void>
  callTool: (toolName: string, args?: Record<string, any>) => Promise<any>
}

function mapDataFields(raw: Record<string, any>) {
  return {
    courses: raw.list_courses ?? null,
    userProfile: raw.get_me ?? null,
    courseOverview: raw.get_course_overview ?? null,
    upcomingSchedule: raw.get_upcoming_schedule ?? null,
    recentLectures: raw.get_recent_lectures ?? null,
    assignments: raw.get_assignments ?? null,
    leaderboard: raw.get_leaderboard ?? null,
    qotd: raw.get_question_of_the_day ?? null,
    arenaStats: raw.get_arena_stats ?? null,
    calendar: raw.get_calendar ?? null,
  }
}

export function useNewtonData(courseHash?: string): NewtonData {
  const [data, setData] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState<NewtonData['syncProgress']>(null)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const unlistenRef = useRef<UnlistenFn | null>(null)

  useEffect(() => {
    return () => {
      if (unlistenRef.current) unlistenRef.current()
    }
  }, [])

  const callTool = useCallback(async (toolName: string, args?: Record<string, any>) => {
    return invoke<any>('mcp_call_tool', {
      serverId: 'newton-school',
      toolName,
      args: args || {},
    })
  }, [])

  // Load cached data from SQLite (instant, no network)
  const loadCached = useCallback(async (): Promise<boolean> => {
    try {
      const cached = await invoke<any>('get_cached_newton_data')
      if (cached?.has_data && cached.data) {
        setData(cached.data)
        setConnected(true)
        // Find the most recent fetched_at
        if (cached.fetched_at) {
          const times = Object.values(cached.fetched_at) as string[]
          if (times.length > 0) {
            setLastSyncedAt(times.sort().reverse()[0])
          }
        }
        return true
      }
      return false
    } catch {
      return false
    }
  }, [])

  // Sync fresh data from MCP server → SQLite cache
  const syncFresh = useCallback(async () => {
    setSyncing(true)
    setError(null)

    // Listen for progress events
    if (unlistenRef.current) unlistenRef.current()
    try {
      unlistenRef.current = await listen<any>('newton-sync-progress', (event) => {
        setSyncProgress(event.payload)
      })
    } catch {
      // listener setup failed, continue anyway
    }

    try {
      const result = await invoke<any>('sync_all_newton_data', {
        courseHash: courseHash || null,
      })
      if (result) {
        setData(result)
        setConnected(true)
        setLastSyncedAt(new Date().toISOString())
      }
    } catch (err: any) {
      const msg = err?.message || err || 'Newton MCP not connected'
      // Only set error if we have no cached data
      setError((prev) => prev)
      if (Object.keys(data).length === 0) {
        setError(msg)
        setConnected(false)
      }
    } finally {
      setSyncing(false)
      setSyncProgress(null)
      if (unlistenRef.current) { unlistenRef.current(); unlistenRef.current = null }
    }
  }, [courseHash])

  // On mount: load cache first (fast), then sync in background
  useEffect(() => {
    let cancelled = false
    async function init() {
      setLoading(true)
      await loadCached()
      if (!cancelled) {
        setLoading(false)
        // Always sync fresh data in the background
        syncFresh()
      }
    }
    init()
    return () => { cancelled = true }
  }, [loadCached, syncFresh])

  const mapped = mapDataFields(data)

  return {
    ...mapped,
    allData: data,
    loading,
    syncing,
    syncProgress,
    error,
    connected,
    lastSyncedAt,
    refresh: syncFresh,
    callTool,
  }
}
