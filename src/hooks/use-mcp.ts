import { useEffect } from 'react'
import { useMcpStore } from '@/stores/mcp-store'

export function useMcp() {
  const servers = useMcpStore((state) => state.servers)
  const loading = useMcpStore((state) => state.loading)
  const error = useMcpStore((state) => state.error)
  const init = useMcpStore((state) => state.init)
  const refresh = useMcpStore((state) => state.refresh)
  const addServer = useMcpStore((state) => state.addServer)
  const removeServer = useMcpStore((state) => state.removeServer)
  const connectServer = useMcpStore((state) => state.connectServer)
  const disconnectServer = useMcpStore((state) => state.disconnectServer)

  useEffect(() => {
    void init()
  }, [init])

  const connectedCount = servers.filter((server) => server.status === 'connected').length

  return {
    servers,
    loading,
    error,
    addServer,
    removeServer,
    connectServer,
    disconnectServer,
    connectedCount,
    refresh,
  }
}
