import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import {
  autoConnectNewton,
  cancelNewtonLogin,
  checkNewtonMcp,
  fetchNewtonProfile,
  getNewtonMcpStatus,
  installNewtonMcp,
  logoutNewton,
  pollNewtonLogin,
  startNewtonLogin,
} from '@/lib/api/newton'
import { getErrorMessage } from '@/lib/error-utils'
import { useNewtonDataStore } from '@/stores/newton-data-store'
import { useUiStore } from '@/stores/ui-store'

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
  authenticated: boolean
  userName: string
  userEmail: string
  linkedAt: string

  loading: boolean
  connectStatus: ConnectStatus
  connectError: string | null
  deviceCode: string | null
  deviceUrl: string | null
  terminalLines: string[]
  _bootDone: boolean
  _loginInProgress: boolean

  boot: () => Promise<void>
  fullConnect: () => Promise<void>
  startLogin: () => Promise<void>
  cancelLogin: () => Promise<void>
  autoConnect: () => Promise<boolean>
  logout: () => Promise<void>
  _setRuntime: (partial: Partial<NewtonAuthStore>) => void
}

let pollInterval: ReturnType<typeof globalThis.setInterval> | null = null
let loginOutputUnlisten: UnlistenFn | null = null

function cleanupPolling() {
  if (pollInterval) {
    window.clearInterval(pollInterval)
    pollInterval = null
  }

  if (loginOutputUnlisten) {
    loginOutputUnlisten()
    loginOutputUnlisten = null
  }
}

async function connectAndLoadProfile(
  set: (partial: Partial<NewtonAuthStore>) => void,
  get: () => NewtonAuthStore
) {
  set({ connectStatus: 'starting_server' })

  const connection = await autoConnectNewton()
  if (!connection.connected) {
    set({
      connectStatus: 'error',
      connectError: connection.error || 'Failed to start Newton MCP server',
    })
    return
  }

  set({ connectStatus: 'fetching_profile' })

  try {
    const profile = await fetchNewtonProfile()
    set({
      connectStatus: 'connected',
      authenticated: true,
      userName: profile.name,
      userEmail: profile.email,
      linkedAt: get().linkedAt || new Date().toISOString(),
    })
  } catch {
    set({
      connectStatus: 'connected',
      authenticated: true,
      linkedAt: get().linkedAt || new Date().toISOString(),
    })
  }
}

export const useNewtonAuthStore = create<NewtonAuthStore>()(
  persist(
    (set, get) => ({
      authenticated: false,
      userName: '',
      userEmail: '',
      linkedAt: '',

      loading: true,
      connectStatus: 'idle',
      connectError: null,
      deviceCode: null,
      deviceUrl: null,
      terminalLines: [],
      _bootDone: false,
      _loginInProgress: false,

      _setRuntime: (partial) => set(partial),

      boot: async () => {
        if (get()._bootDone) return

        set({ loading: true })

        const state = get()
        if (state.authenticated && state.linkedAt) {
          set({ loading: false, _bootDone: true })
          try {
            await autoConnectNewton()
          } catch {
            // Cached data still lets the app boot even if MCP startup fails.
          }
          return
        }

        try {
          const status = await getNewtonMcpStatus()
          if (status.authenticated) {
            set({
              authenticated: true,
              linkedAt: new Date().toISOString(),
              userName: status.saved_name || '',
              userEmail: status.saved_email || '',
              loading: false,
              _bootDone: true,
            })

            try {
              await autoConnectNewton()
            } catch {
              // Ignore startup failures during background auto-connect.
            }

            return
          }
        } catch {
          // Fall through to the logged-out state.
        }

        set({ loading: false, _bootDone: true })
      },

      fullConnect: async () => {
        set({
          connectStatus: 'checking_mcp',
          connectError: null,
        })

        let authenticated = get().authenticated

        if (!authenticated) {
          try {
            const check = await checkNewtonMcp()
            authenticated = check.authenticated

            if (!check.installed && !authenticated) {
              set({ connectStatus: 'installing_mcp' })
              await installNewtonMcp().catch(() => undefined)
            }
          } catch {
            // Fallback status check below handles missing binaries or transient errors.
          }
        }

        if (!authenticated) {
          try {
            const status = await getNewtonMcpStatus()
            authenticated = status.authenticated
          } catch {
            authenticated = false
          }
        }

        if (!authenticated) {
          set({ connectStatus: 'not_logged_in' })
          return
        }

        try {
          await connectAndLoadProfile(set, get)
        } catch (error) {
          set({
            connectStatus: 'error',
            connectError: getErrorMessage(error, 'Failed to connect Newton School'),
          })
        }
      },

      startLogin: async () => {
        if (get()._loginInProgress) return

        set({
          _loginInProgress: true,
          connectStatus: 'starting_login',
          terminalLines: [],
          connectError: null,
        })

        cleanupPolling()

        try {
          loginOutputUnlisten = await listen<string>('newton-login-output', (event) => {
            set((state) => ({
              terminalLines: [...state.terminalLines.slice(-99), event.payload],
            }))
          })
        } catch {
          // Login can still proceed even if streaming terminal output is unavailable.
        }

        try {
          const result = await startNewtonLogin()

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

          set({
            connectStatus: 'waiting_for_auth',
            deviceCode: result.code || null,
            deviceUrl: result.url || null,
          })

          pollInterval = globalThis.setInterval(async () => {
            try {
              const poll = await pollNewtonLogin()
              if (!poll.complete) return

              cleanupPolling()
              set({ _loginInProgress: false })

              if (poll.success) {
                set({
                  authenticated: true,
                  linkedAt: new Date().toISOString(),
                })
                await get().fullConnect()
                return
              }

              set({
                connectStatus: 'error',
                connectError: 'Login was not successful. Please try again.',
              })
            } catch {
              // Keep polling until the backend resolves the login flow.
            }
          }, 2000)
        } catch (error) {
          cleanupPolling()
          set({
            _loginInProgress: false,
            connectStatus: 'error',
            connectError: getErrorMessage(error, 'Failed to start login'),
          })
        }
      },

      cancelLogin: async () => {
        cleanupPolling()
        set({
          _loginInProgress: false,
          connectStatus: 'not_logged_in',
          deviceCode: null,
          deviceUrl: null,
        })
        await cancelNewtonLogin().catch(() => undefined)
      },

      autoConnect: async () => {
        try {
          const result = await autoConnectNewton()
          return result.connected
        } catch {
          return false
        }
      },

      logout: async () => {
        cleanupPolling()

        try {
          await logoutNewton()
        } catch {
          // We still clear local session state even if the backend logout fails.
        }

        useNewtonDataStore.getState().reset()
        useUiStore.getState().setCurrentPage('settings')

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
