import { useState, useEffect, useCallback } from 'react'
import { invoke } from '@/lib/tauri'
import type { McpServer, McpServerStatus } from '@/types/mcp'

export function useMcp() {
  const [servers, setServers] = useState<McpServer[]>([])

  // Load servers from the Tauri backend
  const loadServers = useCallback(async () => {
    try {
      const result = await invoke<any>('mcp_list_servers')
      const serverList = result?.servers || []
      setServers(
        serverList.map((s: any) => ({
          id: s.id,
          name: s.name,
          command: s.command,
          args: s.args || [],
          status: s.connected ? 'connected' : 'disconnected',
          tools: [],
          last_connected: s.connected ? new Date().toISOString() : undefined,
        }))
      )
    } catch {
      // Backend not available yet - start with empty
      setServers([])
    }
  }, [])

  useEffect(() => {
    loadServers()
  }, [loadServers])

  const addServer = useCallback(
    async (server: Omit<McpServer, 'id' | 'status' | 'tools'>) => {
      const id = crypto.randomUUID()
      try {
        await invoke('mcp_add_server', {
          config: {
            id,
            name: server.name,
            transport_type: 'stdio',
            command: server.command,
            args: server.args,
            env: {},
            enabled: true,
          },
        })
        await loadServers()
      } catch {
        // Fallback: add locally
        const newServer: McpServer = {
          ...server,
          id,
          status: 'disconnected',
          tools: [],
        }
        setServers((prev) => [...prev, newServer])
      }
      return id
    },
    [loadServers]
  )

  const removeServer = useCallback(
    async (id: string) => {
      try {
        await invoke('mcp_remove_server', { serverId: id })
        await loadServers()
      } catch {
        setServers((prev) => prev.filter((s) => s.id !== id))
      }
    },
    [loadServers]
  )

  const updateServerStatus = useCallback((id: string, status: McpServerStatus) => {
    setServers((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, status, last_connected: status === 'connected' ? new Date().toISOString() : s.last_connected }
          : s
      )
    )
  }, [])

  const connectServer = useCallback(
    async (id: string) => {
      updateServerStatus(id, 'connecting')
      try {
        await invoke('mcp_start_server', { serverId: id })
        updateServerStatus(id, 'connected')
      } catch {
        updateServerStatus(id, 'disconnected')
      }
    },
    [updateServerStatus]
  )

  const disconnectServer = useCallback(
    async (id: string) => {
      try {
        await invoke('mcp_stop_server', { serverId: id })
      } catch {
        // ignore
      }
      updateServerStatus(id, 'disconnected')
    },
    [updateServerStatus]
  )

  const connectedCount = servers.filter((s) => s.status === 'connected').length

  return {
    servers,
    addServer,
    removeServer,
    connectServer,
    disconnectServer,
    connectedCount,
    refresh: loadServers,
  }
}
