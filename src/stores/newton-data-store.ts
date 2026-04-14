import { create } from 'zustand'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import {
  callNewtonTool as callNewtonToolApi,
  getCachedNewtonData,
  syncAllNewtonData,
} from '@/lib/api/newton'
import { getErrorMessage } from '@/lib/error-utils'

export interface SyncProgress {
  step: string
  phase?: number
  tool?: string
  detail?: string
  done: number
  total: number
}

type NewtonPayload = Record<string, unknown>

interface NewtonDataStore {
  data: NewtonPayload
  loading: boolean
  syncing: boolean
  syncProgress: SyncProgress | null
  error: string | null
  connected: boolean
  lastSyncedAt: string | null
  initialized: boolean
  _syncInProgress: boolean

  loadCached: () => Promise<boolean>
  syncFresh: (courseHash?: string) => Promise<void>
  init: () => Promise<void>
  refresh: () => Promise<void>
  reset: () => void
}

interface CachedTimestampMap {
  [toolName: string]: string
}

function mapDataFields(raw: NewtonPayload) {
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
    arenaFilters: raw.get_arena_filters ?? null,
    calendar: raw.get_calendar ?? null,
    assessments: raw.get_assessments ?? null,
    lectureDetails: raw.get_lecture_details ?? null,
    subjectProgress: raw.get_subject_progress ?? null,
  }
}

let syncProgressUnlisten: UnlistenFn | null = null

function getLatestFetchedAt(fetchedAt?: Record<string, string>): string | null {
  if (!fetchedAt) return null

  const timestamps = Object.values(fetchedAt as CachedTimestampMap)
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .sort()

  return timestamps.length > 0 ? timestamps[timestamps.length - 1] : null
}

function clearSyncProgressListener() {
  if (!syncProgressUnlisten) return
  syncProgressUnlisten()
  syncProgressUnlisten = null
}

async function ensureSyncProgressListener(
  onProgress: (progress: SyncProgress) => void
) {
  if (syncProgressUnlisten) return

  syncProgressUnlisten = await listen<SyncProgress>(
    'newton-sync-progress',
    (event) => onProgress(event.payload)
  )
}

const initialState = {
  data: {} as NewtonPayload,
  loading: true,
  syncing: false,
  syncProgress: null,
  error: null,
  connected: false,
  lastSyncedAt: null,
  initialized: false,
  _syncInProgress: false,
}

export const useNewtonDataStore = create<NewtonDataStore>()((set, get) => ({
  ...initialState,

  loadCached: async () => {
    try {
      const cached = await getCachedNewtonData()
      if (!cached.has_data || !cached.data) {
        return false
      }

      set({
        data: cached.data,
        connected: true,
        lastSyncedAt: getLatestFetchedAt(cached.fetched_at),
      })

      return true
    } catch (error) {
      console.warn(
        '[newton-data-store] Failed to load cached data:',
        getErrorMessage(error)
      )
      return false
    }
  },

  syncFresh: async (courseHash) => {
    if (get()._syncInProgress) return

    set({
      _syncInProgress: true,
      syncing: true,
      error: null,
    })

    try {
      await ensureSyncProgressListener((progress) => {
        set({ syncProgress: progress })
      })
    } catch (error) {
      console.warn(
        '[newton-data-store] Failed to register sync-progress listener:',
        getErrorMessage(error)
      )
    }

    const timeoutId = window.setTimeout(() => {
      if (!get()._syncInProgress) return

      const hasData = Object.keys(get().data).length > 0
      set({
        syncing: false,
        syncProgress: null,
        _syncInProgress: false,
        error: hasData
          ? null
          : 'Sync timed out. Newton MCP may be unresponsive right now.',
      })
      clearSyncProgressListener()
    }, 90_000)

    try {
      const result = await syncAllNewtonData(courseHash ?? null)
      set({
        data: result,
        connected: true,
        lastSyncedAt: new Date().toISOString(),
      })
    } catch (error) {
      const hasData = Object.keys(get().data).length > 0

      if (!hasData) {
        set({
          error: getErrorMessage(error, 'Newton MCP is not connected'),
          connected: false,
        })
      }
    } finally {
      window.clearTimeout(timeoutId)
      set({
        syncing: false,
        syncProgress: null,
        _syncInProgress: false,
      })
      clearSyncProgressListener()
    }
  },

  init: async () => {
    if (get().initialized) return

    set({
      initialized: true,
      loading: true,
    })

    await get().loadCached()

    set({ loading: false })

    void get().syncFresh()
  },

  refresh: async () => {
    await get().syncFresh()
  },

  reset: () => {
    clearSyncProgressListener()
    set({
      ...initialState,
      loading: false,
    })
  },
}))

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

export async function callNewtonTool<T = unknown>(
  toolName: string,
  args?: Record<string, unknown>
): Promise<T> {
  return callNewtonToolApi<T>(toolName, args)
}
