import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { invoke } from '@/lib/tauri'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

export interface UserProfile {
  name: string
  email: string
}

export type ConnectStatus =
  | 'idle'
  | 'checking_mcp'
  | 'installing_mcp'
  | 'not_logged_in'
  | 'starting_login'
  | 'waiting_for_auth'
  | 'starting_server'
  | 'fetching_profile'
  | 'connected'
  | 'error'

interface NewtonAuthStore {
  // Persisted across app restarts
  authenticated: boolean
  userName: string
  userEmail: string
  linkedAt: string

  // Runtime state (not persisted)
  loading: boolean
  connectStatus: ConnectStatus
  connectError: string | null
  deviceCode: string | null
  deviceUrl: string | null
  terminalLines: string[]
  _bootDone: boolean
  _loginInProgress: boolean

  // Actions
  boot: () => Promise<void>
  fullConnect: () => Promise<void>
  startLogin: () => Promise<void>
  cancelLogin: () => Promise<void>
  autoConnect: () => Promise<boolean>
  logout: () => Promise<void>
  _setRuntime: (partial: Partial<NewtonAuthStore>) => void
}

function parseToolText(data: any): any {
  try {
    if (!data) return null
    if (typeof data === 'object' && !data?.content?.[0]?.text) return data
    const text = data?.content?.[0]?.text
    if (text) return JSON.parse(text)
    return data
  } catch {
    return data
  }
}

let pollInterval: ReturnType<typeof setInterval> | null = null
let unlistenFn: UnlistenFn | null = null

function cleanupPolling() {
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null }
  if (unlistenFn) { unlistenFn(); unlistenFn = null }
}

export const useNewtonAuthStore = create<NewtonAuthStore>()(
  persist(
    (set, get) => ({
      // Persisted
      authenticated: false,
      userName: '',
      userEmail: '',
      linkedAt: '',

      // Runtime
      loading: true,
      connectStatus: 'idle' as ConnectStatus,
      connectError: null,
      deviceCode: null,
      deviceUrl: null,
      terminalLines: [],
      _bootDone: false,
      _loginInProgress: false,

      _setRuntime: (partial) => set(partial),

      // Called ONCE from App.tsx on startup
      boot: async () => {
        if (get()._bootDone) return
        set({ loading: true })

        const state = get()

        // If we have a persisted session, trust it and try to auto-connect
        if (state.authenticated && state.linkedAt) {
          set({ loading: false, _bootDone: true })
          // Auto-connect MCP server in background
          try {
            await invoke<any>('auto_connect_newton')
          } catch {
            // Server might fail to start — that's ok, data is cached
          }
          return
        }

        // No persisted session — check with newton-mcp binary
        try {
          const result = await invoke<any>('newton_mcp_status')
          if (result.authenticated) {
            set({
              authenticated: true,
              linkedAt: new Date().toISOString(),
              userName: result.saved_name || '',
              userEmail: result.saved_email || '',
              loading: false,
              _bootDone: true,
            })
            // Auto-connect
            try { await invoke<any>('auto_connect_newton') } catch {}
            return
          }
        } catch {}

        set({ loading: false, _bootDone: true })
      },

      // Full connect flow: check → install → detect auth → connect or show login
      fullConnect: async () => {
        set({ connectStatus: 'checking_mcp', connectError: null })

        let authenticated = false

        // Check if authenticated (from persisted state first)
        if (get().authenticated) {
          authenticated = true
        }

        if (!authenticated) {
          try {
            const check = await invoke<any>('check_newton_mcp')
            authenticated = check.authenticated || false
            if (!check.installed && !authenticated) {
              set({ connectStatus: 'installing_mcp' })
              await invoke<any>('install_newton_mcp').catch(() => {})
            }
          } catch {}
        }

        if (!authenticated) {
          try {
            const status = await invoke<any>('newton_mcp_status')
            authenticated = status.authenticated || false
          } catch {}
        }

        if (authenticated) {
          // Start MCP server and verify
          set({ connectStatus: 'starting_server' })
          try {
            const result = await invoke<any>('auto_connect_newton')
            if (!result.connected) {
              set({ connectStatus: 'error', connectError: result.error || 'Failed to start MCP server' })
              return
            }
          } catch (err: any) {
            set({ connectStatus: 'error', connectError: err?.message || 'Failed to start MCP server' })
            return
          }

          // Fetch profile
          set({ connectStatus: 'fetching_profile' })
          try {
            const profileResult = await invoke<any>('mcp_call_tool', {
              serverId: 'newton-school',
              toolName: 'get_me',
              args: {},
            })
            const parsed = parseToolText(profileResult)
            const name = parsed?.name || parsed?.user?.name || ''
            const email = parsed?.email || parsed?.user?.email || ''
            set({
              connectStatus: 'connected',
              authenticated: true,
              userName: name,
              userEmail: email,
              linkedAt: get().linkedAt || new Date().toISOString(),
            })
          } catch {
            // Profile fetch failed but server is connected
            set({
              connectStatus: 'connected',
              authenticated: true,
              linkedAt: get().linkedAt || new Date().toISOString(),
            })
          }
          return
        }

        set({ connectStatus: 'not_logged_in' })
      },

      // Start interactive login — NEVER auto-opens browser
      startLogin: async () => {
        if (get()._loginInProgress) return
        set({ _loginInProgress: true, connectStatus: 'starting_login', terminalLines: [], connectError: null })

        cleanupPolling()
        try {
          unlistenFn = await listen<string>('newton-login-output', (event) => {
            set((s) => ({ terminalLines: [...s.terminalLines, event.payload] }))
          })
        } catch {}

        try {
          const result = await invoke<any>('newton_mcp_start_login')

          if (result.already_authenticated) {
            cleanupPolling()
            set({
              _loginInProgress: false,
              authenticated: true,
              linkedAt: new Date().toISOString(),
            })
            await get().fullConnect()
            return
          }

          const code = result.code as string
          const url = result.url as string

          set({
            connectStatus: 'waiting_for_auth',
            deviceCode: code,
            deviceUrl: url,
          })

          // Poll every 2s
          pollInterval = setInterval(async () => {
            try {
              const poll = await invoke<any>('newton_mcp_poll_login')
              if (poll.complete) {
                cleanupPolling()
                set({ _loginInProgress: false })

                if (poll.success) {
                  set({
                    authenticated: true,
                    linkedAt: new Date().toISOString(),
                  })
                  // Now connect and fetch profile
                  await get().fullConnect()
                } else {
                  set({
                    connectStatus: 'error',
                    connectError: 'Login was not successful. Please try again.',
                  })
                }
              }
            } catch {}
          }, 2000)
        } catch (err: any) {
          cleanupPolling()
          set({
            _loginInProgress: false,
            connectStatus: 'error',
            connectError: err?.message || err || 'Failed to start login',
          })
        }
      },

      cancelLogin: async () => {
        cleanupPolling()
        set({ _loginInProgress: false, connectStatus: 'not_logged_in', deviceCode: null, deviceUrl: null })
        await invoke('newton_mcp_cancel_login').catch(() => {})
      },

      autoConnect: async () => {
        try {
          const result = await invoke<any>('auto_connect_newton')
          return result.connected || false
        } catch {
          return false
        }
      },

      logout: async () => {
        cleanupPolling()
        try {
          await invoke('newton_mcp_logout')
        } catch {}
        set({
          authenticated: false,
          userName: '',
          userEmail: '',
          linkedAt: '',
          connectStatus: 'idle',
          connectError: null,
          deviceCode: null,
          deviceUrl: null,
          terminalLines: [],
          _loginInProgress: false,
        })
      },
    }),
    {
      name: 'newton-auth-store',
      partialize: (state) => ({
        authenticated: state.authenticated,
        userName: state.userName,
        userEmail: state.userEmail,
        linkedAt: state.linkedAt,
      }),
    }
  )
)
