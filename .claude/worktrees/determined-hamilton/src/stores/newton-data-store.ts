import { create } from 'zustand'
import { invoke } from '@/lib/tauri'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import {
  parseToolText,
  mapCourseOverview,
  parseSchedule,
  parseLectures,
  parseAssignments,
  parseLeaderboard,
  mapQotd,
} from '@/lib/newton-parsers'

export interface SyncProgress {
  step: string
  tool?: string
  done: number
  total: number
}

interface NewtonDataStore {
  data: Record<string, any>
  loading: boolean
  syncing: boolean
  syncProgress: SyncProgress | null
  error: string | null
  connected: boolean
  lastSyncedAt: string | null
  _syncInProgress: boolean

  loadCached: () => Promise<boolean>
  syncFresh: (courseHash?: string) => Promise<void>
  init: () => Promise<void>
  refresh: () => Promise<void>
}

function mapDataFields(raw: Record<string, any>) {
  const overviewRaw = raw.get_course_overview
    ? parseToolText(raw.get_course_overview)
    : null
  const qotdRaw = raw.get_question_of_the_day
    ? parseToolText(raw.get_question_of_the_day)
    : null

  return {
    courses: raw.list_courses ? parseToolText(raw.list_courses) : null,
    userProfile: raw.get_me ? parseToolText(raw.get_me) : null,
    courseOverview: overviewRaw ? mapCourseOverview(overviewRaw) : null,
    upcomingSchedule: raw.get_upcoming_schedule
      ? parseSchedule(raw.get_upcoming_schedule)
      : [],
    recentLectures: raw.get_recent_lectures
      ? parseLectures(raw.get_recent_lectures)
      : [],
    assignments: raw.get_assignments
      ? parseAssignments(raw.get_assignments)
      : [],
    leaderboard: raw.get_leaderboard
      ? parseLeaderboard(raw.get_leaderboard)
      : [],
    qotd: qotdRaw ? mapQotd(qotdRaw) : null,
    arenaStats: raw.get_arena_stats ? parseToolText(raw.get_arena_stats) : null,
    calendar: raw.get_calendar ? parseToolText(raw.get_calendar) : null,
  }
}

let _initDone = false
let _unlistenFn: UnlistenFn | null = null

export const useNewtonDataStore = create<NewtonDataStore>()((set, get) => ({
  data: {},
  loading: true,
  syncing: false,
  syncProgress: null,
  error: null,
  connected: false,
  lastSyncedAt: null,
  _syncInProgress: false,

  loadCached: async () => {
    try {
      const cached = await invoke<any>('get_cached_newton_data')
      if (cached?.has_data && cached.data) {
        set({ data: cached.data, connected: true })
        if (cached.fetched_at) {
          const times = Object.values(cached.fetched_at) as string[]
          if (times.length > 0) {
            set({ lastSyncedAt: times.sort().reverse()[0] })
          }
        }
        return true
      }
      return false
    } catch {
      return false
    }
  },

  syncFresh: async (courseHash?: string) => {
    // Guard: prevent concurrent syncs
    if (get()._syncInProgress) return
    set({ _syncInProgress: true, syncing: true, error: null })

    // Listen for progress events
    if (_unlistenFn) { _unlistenFn(); _unlistenFn = null }
    try {
      _unlistenFn = await listen<any>('newton-sync-progress', (event) => {
        set({ syncProgress: event.payload })
      })
    } catch {}

    try {
      const result = await invoke<any>('sync_all_newton_data', {
        courseHash: courseHash || null,
      })
      if (result) {
        set({ data: result, connected: true, lastSyncedAt: new Date().toISOString() })
      }
    } catch (err: any) {
      const hasData = Object.keys(get().data).length > 0
      if (!hasData) {
        set({ error: err?.message || err || 'Newton MCP not connected', connected: false })
      }
    } finally {
      set({ syncing: false, syncProgress: null, _syncInProgress: false })
      if (_unlistenFn) { _unlistenFn(); _unlistenFn = null }
    }
  },

  init: async () => {
    if (_initDone) return
    _initDone = true
    set({ loading: true })
    await get().loadCached()
    set({ loading: false })
    // Sync fresh data in background
    get().syncFresh()
  },

  refresh: async () => {
    await get().syncFresh()
  },
}))

// Convenience hook that maps store data to named fields
export function useNewtonData() {
  const store = useNewtonDataStore()
  const mapped = mapDataFields(store.data)
  return {
    ...mapped,
    allData: store.data,
    loading: store.loading,
    syncing: store.syncing,
    syncProgress: store.syncProgress,
    error: store.error,
    connected: store.connected,
    lastSyncedAt: store.lastSyncedAt,
    refresh: store.refresh,
  }
}
