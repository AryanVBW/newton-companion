import { useEffect } from 'react'
import {
  type ConnectStatus,
  type UserProfile,
  useNewtonAuthStore,
} from '@/stores/newton-auth-store'

export interface NewtonAuthState {
  authenticated: boolean
  expires: string
  loading: boolean
}

export interface ConnectState {
  status: ConnectStatus
  error?: string
  userProfile?: UserProfile
  deviceCode?: string
  deviceUrl?: string
  terminalLines?: string[]
}

export function useNewtonAuth() {
  const authenticated = useNewtonAuthStore((state) => state.authenticated)
  const loading = useNewtonAuthStore((state) => state.loading)
  const userName = useNewtonAuthStore((state) => state.userName)
  const userEmail = useNewtonAuthStore((state) => state.userEmail)
  const connectStatus = useNewtonAuthStore((state) => state.connectStatus)
  const connectError = useNewtonAuthStore((state) => state.connectError)
  const deviceCode = useNewtonAuthStore((state) => state.deviceCode)
  const deviceUrl = useNewtonAuthStore((state) => state.deviceUrl)
  const terminalLines = useNewtonAuthStore((state) => state.terminalLines)
  const linkedAt = useNewtonAuthStore((state) => state.linkedAt)
  const boot = useNewtonAuthStore((state) => state.boot)
  const fullConnect = useNewtonAuthStore((state) => state.fullConnect)
  const startLogin = useNewtonAuthStore((state) => state.startLogin)
  const cancelLogin = useNewtonAuthStore((state) => state.cancelLogin)
  const autoConnect = useNewtonAuthStore((state) => state.autoConnect)
  const logout = useNewtonAuthStore((state) => state.logout)

  useEffect(() => {
    void boot()
  }, [boot])

  return {
    auth: {
      authenticated,
      expires: linkedAt,
      loading,
    } satisfies NewtonAuthState,
    connectState: {
      status: connectStatus,
      error: connectError ?? undefined,
      userProfile:
        userName || userEmail
          ? { name: userName, email: userEmail }
          : undefined,
      deviceCode: deviceCode ?? undefined,
      deviceUrl: deviceUrl ?? undefined,
      terminalLines,
    } satisfies ConnectState,
    fullConnect,
    startLogin,
    cancelLogin,
    autoConnect,
    logout,
  }
}
