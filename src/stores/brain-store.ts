import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

// ---------------------------------------------------------------------------
// Types — mirrors the Rust BrainEvent enum
// ---------------------------------------------------------------------------

export type BrainEventType =
  | 'goal_accepted'
  | 'planning_started'
  | 'plan_generated'
  | 'step_started'
  | 'step_completed'
  | 'step_healing'
  | 'replanning'
  | 'goal_completed'
  | 'goal_failed'
  | 'memory_updated'
  | 'provider_switched'
  | 'progress'

export interface BrainEvent {
  event: BrainEventType
  data: Record<string, unknown>
}

export interface BrainGoal {
  id: string
  description: string
  status: string
  result_summary?: string
  created_at: string
  completed_at?: string
  total_steps: number
  completed_steps: number
  revision: number
}

export interface BrainStatus {
  active_goal: BrainGoal | null
  current_plan: unknown | null
  is_running: boolean
  total_goals_completed: number
  memory_entries: number
  available_tools: string[]
  configured_providers: string[]
}

export interface BrainProgress {
  goalId: string
  completedSteps: number
  totalSteps: number
  currentStep: string | null
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface BrainStore {
  // State
  isRunning: boolean
  activeGoalId: string | null
  activeGoalDescription: string | null
  progress: BrainProgress | null
  events: BrainEvent[]
  history: BrainGoal[]
  status: BrainStatus | null
  lastResult: string | null
  lastError: string | null

  // Event listener
  _unlisten: UnlistenFn | null

  // Actions
  init: () => Promise<void>
  cleanup: () => void
  submitGoal: (goal: string, context?: string) => Promise<string>
  cancelGoal: () => Promise<void>
  loadStatus: () => Promise<void>
  loadHistory: (limit?: number) => Promise<void>
  clearMemory: (category?: string) => Promise<void>
  clearEvents: () => void
}

export const useBrainStore = create<BrainStore>((set, get) => ({
  // Initial state
  isRunning: false,
  activeGoalId: null,
  activeGoalDescription: null,
  progress: null,
  events: [],
  history: [],
  status: null,
  lastResult: null,
  lastError: null,
  _unlisten: null,

  // Start listening for brain events from the Rust backend
  init: async () => {
    // Avoid double-init
    if (get()._unlisten) return

    const unlisten = await listen<BrainEvent>('brain-event', (event) => {
      const brainEvent = event.payload
      const state = get()

      // Append to event log (keep last 200)
      const newEvents = [...state.events, brainEvent].slice(-200)

      const updates: Partial<BrainStore> = { events: newEvents }

      // Handle specific event types
      switch (brainEvent.event) {
        case 'goal_accepted':
          updates.isRunning = true
          updates.activeGoalId = brainEvent.data.goal_id as string
          updates.activeGoalDescription = brainEvent.data.description as string
          updates.lastError = null
          updates.lastResult = null
          break

        case 'progress':
          updates.progress = {
            goalId: brainEvent.data.goal_id as string,
            completedSteps: brainEvent.data.completed_steps as number,
            totalSteps: brainEvent.data.total_steps as number,
            currentStep: (brainEvent.data.current_step as string) || null,
          }
          break

        case 'goal_completed':
          updates.isRunning = false
          updates.lastResult = brainEvent.data.summary as string
          updates.progress = null
          break

        case 'goal_failed':
          updates.isRunning = false
          updates.lastError = brainEvent.data.error as string
          updates.progress = null
          break
      }

      set(updates)
    })

    set({ _unlisten: unlisten })

    // Load initial status
    get().loadStatus()
  },

  cleanup: () => {
    const { _unlisten } = get()
    if (_unlisten) {
      _unlisten()
      set({ _unlisten: null })
    }
  },

  submitGoal: async (goal: string, context?: string) => {
    set({ isRunning: true, lastError: null, lastResult: null })

    try {
      const result = await invoke<{ success: boolean; result: string }>(
        'brain_execute_goal',
        { goal, context }
      )
      set({ lastResult: result.result, isRunning: false })
      // Refresh history after completion
      get().loadHistory()
      return result.result
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      set({ lastError: errorMsg, isRunning: false })
      throw error
    }
  },

  cancelGoal: async () => {
    try {
      await invoke('brain_cancel_goal')
    } catch (error) {
      console.error('Failed to cancel goal:', error)
    }
  },

  loadStatus: async () => {
    try {
      const status = await invoke<BrainStatus>('brain_get_status')
      set({ status, isRunning: status.is_running })
    } catch (error) {
      console.error('Failed to load brain status:', error)
    }
  },

  loadHistory: async (limit = 20) => {
    try {
      const result = await invoke<{ goals: BrainGoal[] }>('brain_get_history', {
        limit,
      })
      set({ history: result.goals })
    } catch (error) {
      console.error('Failed to load brain history:', error)
    }
  },

  clearMemory: async (category?: string) => {
    try {
      await invoke('brain_clear_memory', { category })
    } catch (error) {
      console.error('Failed to clear memory:', error)
    }
  },

  clearEvents: () => {
    set({ events: [] })
  },
}))
