import { useState, useEffect, useCallback, useRef } from 'react'
import { invoke } from '@/lib/tauri'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

export interface NewtonAuthState {
  authenticated: boolean
  expires: string
  loading: boolean
}

export interface UserProfile {
  name: string
  email: string
}

export type ConnectStatus =
  | 'idle'
  | 'checking_mcp'         // checking if newton-mcp binary exists
  | 'installing_mcp'       // npm install -g @newtonschool/newton-mcp
  | 'not_logged_in'        // newton-mcp exists but user not logged in
  | 'starting_login'       // spawning newton-mcp login process
  | 'waiting_for_auth'     // code shown, waiting for user to authorize on web
  | 'starting_server'      // spawning newton-mcp as MCP server
  | 'fetching_profile'     // calling get_me to verify data flows
  | 'connected'            // all good - MCP running, data verified
  | 'error'

export interface ConnectState {
  status: ConnectStatus
  error?: string
  userProfile?: UserProfile
  deviceCode?: string
  deviceUrl?: string
  terminalLines?: string[]
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

export function useNewtonAuth() {
  const [auth, setAuth] = useState<NewtonAuthState>({
    authenticated: false,
    expires: '',
    loading: true,
  })

  const [connectState, setConnectState] = useState<ConnectState>({ status: 'idle' })
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const unlistenRef = useRef<UnlistenFn | null>(null)
  const loginInProgressRef = useRef(false)

  // Cleanup polling + event listener on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      if (unlistenRef.current) unlistenRef.current()
    }
  }, [])

  // Initial auth check on mount — checks both newton-mcp binary AND local DB
  const checkStatus = useCallback(async () => {
    try {
      const result = await invoke<any>('newton_mcp_status')
      setAuth({
        authenticated: result.authenticated || false,
        expires: result.expires || '',
        loading: false,
      })
    } catch {
      try {
        const check = await invoke<any>('check_newton_mcp')
        setAuth({
          authenticated: check.authenticated || check.has_saved_session || false,
          expires: '',
          loading: false,
        })
      } catch {
        setAuth((prev) => ({ ...prev, loading: false }))
      }
    }
  }, [])

  useEffect(() => {
    checkStatus()
  }, [checkStatus])

  // Start MCP server + fetch user profile
  const startServerAndVerify = useCallback(async (): Promise<UserProfile | null> => {
    setConnectState((prev) => ({ ...prev, status: 'starting_server' }))
    try {
      const result = await invoke<any>('auto_connect_newton')
      if (!result.connected) {
        setConnectState({
          status: 'error',
          error: result.error || 'Failed to start Newton MCP server',
        })
        return null
      }
    } catch (err: any) {
      setConnectState({
        status: 'error',
        error: err?.message || err || 'Failed to start MCP server',
      })
      return null
    }

    // Fetch user profile to verify data flows
    setConnectState((prev) => ({ ...prev, status: 'fetching_profile' }))
    try {
      const profileResult = await invoke<any>('mcp_call_tool', {
        serverId: 'newton-school',
        toolName: 'get_me',
        args: {},
      })
      const parsed = parseToolText(profileResult)
      const profile: UserProfile = {
        name: parsed?.name || parsed?.user?.name || '',
        email: parsed?.email || parsed?.user?.email || '',
      }
      setConnectState({ status: 'connected', userProfile: profile })
      setAuth((prev) => ({ ...prev, authenticated: true }))
      return profile
    } catch (err: any) {
      // Server started but profile fetch failed — still mark as connected
      setConnectState({ status: 'connected' })
      setAuth((prev) => ({ ...prev, authenticated: true }))
      return null
    }
  }, [])

  // Full connect flow: check → install → login or auto-connect
  const fullConnect = useCallback(async () => {
    setConnectState({ status: 'checking_mcp' })

    let authenticated = false
    try {
      const check = await invoke<any>('check_newton_mcp')
      authenticated = check.authenticated || check.has_saved_session || false
      if (!check.installed && !authenticated) {
        setConnectState({ status: 'installing_mcp' })
        await invoke<any>('install_newton_mcp').catch(() => {})
      }
    } catch {
      // npx fallback will handle it
    }

    // Double-check with status command
    if (!authenticated) {
      try {
        const status = await invoke<any>('newton_mcp_status')
        authenticated = status.authenticated || false
        if (authenticated) {
          setAuth((prev) => ({ ...prev, authenticated: true, expires: status.expires || '' }))
        }
      } catch {
        // not authenticated
      }
    }

    if (authenticated) {
      return await startServerAndVerify()
    }

    setConnectState({ status: 'not_logged_in' })
    return null
  }, [startServerAndVerify])

  // Start the interactive login — NO auto browser opening
  const startLogin = useCallback(async () => {
    // Guard: prevent double login
    if (loginInProgressRef.current) return null
    loginInProgressRef.current = true

    setConnectState({ status: 'starting_login', terminalLines: [] })

    // Listen for terminal output lines from the backend
    if (unlistenRef.current) unlistenRef.current()
    try {
      unlistenRef.current = await listen<string>('newton-login-output', (event) => {
        setConnectState((prev) => ({
          ...prev,
          terminalLines: [...(prev.terminalLines || []), event.payload],
        }))
      })
    } catch {
      // listener setup failed
    }

    try {
      const result = await invoke<any>('newton_mcp_start_login')

      // Already authenticated case
      if (result.already_authenticated) {
        if (unlistenRef.current) { unlistenRef.current(); unlistenRef.current = null }
        loginInProgressRef.current = false
        setAuth((prev) => ({ ...prev, authenticated: true }))
        return await startServerAndVerify()
      }

      const code = result.code as string
      const url = result.url as string

      setConnectState((prev) => ({
        ...prev,
        status: 'waiting_for_auth',
        deviceCode: code,
        deviceUrl: url,
      }))

      // DO NOT auto-open browser — user clicks "Open Activation Page" button manually

      // Start polling every 2s for login completion
      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = setInterval(async () => {
        try {
          const poll = await invoke<any>('newton_mcp_poll_login')
          if (poll.complete) {
            if (pollRef.current) {
              clearInterval(pollRef.current)
              pollRef.current = null
            }
            if (unlistenRef.current) { unlistenRef.current(); unlistenRef.current = null }
            loginInProgressRef.current = false

            if (poll.success) {
              setAuth((prev) => ({ ...prev, authenticated: true }))
              await startServerAndVerify()
            } else {
              setConnectState({
                status: 'error',
                error: 'Login was not successful. Please try again.',
              })
            }
          }
        } catch {
          // Polling error - keep trying
        }
      }, 2000)

      return null
    } catch (err: any) {
      if (unlistenRef.current) { unlistenRef.current(); unlistenRef.current = null }
      loginInProgressRef.current = false
      setConnectState({
        status: 'error',
        error: err?.message || err || 'Failed to start login process',
      })
      return null
    }
  }, [startServerAndVerify])

  // Cancel login
  const cancelLogin = useCallback(async () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    if (unlistenRef.current) { unlistenRef.current(); unlistenRef.current = null }
    loginInProgressRef.current = false
    await invoke('newton_mcp_cancel_login').catch(() => {})
    setConnectState({ status: 'not_logged_in' })
  }, [])

  // Auto-connect (for App.tsx startup) — no login, just start server
  const autoConnect = useCallback(async () => {
    try {
      const result = await invoke<any>('auto_connect_newton')
      return result.connected || false
    } catch {
      return false
    }
  }, [])

  // Logout — clears local session + newton-mcp credentials
  const logout = useCallback(async () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    if (unlistenRef.current) { unlistenRef.current(); unlistenRef.current = null }
    loginInProgressRef.current = false
    try {
      await invoke('newton_mcp_logout')
      setAuth({ authenticated: false, expires: '', loading: false })
      setConnectState({ status: 'idle' })
    } catch (err: any) {
      console.error('Logout failed:', err)
    }
  }, [])

  return {
    auth,
    connectState,
    fullConnect,
    startLogin,
    cancelLogin,
    autoConnect,
    logout,
    checkStatus,
    startServerAndVerify,
  }
}
