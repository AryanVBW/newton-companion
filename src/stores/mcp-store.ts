import { create } from 'zustand'
import {
  addMcpServer,
  hydrateMcpServers,
  removeMcpServer,
  startMcpServer,
  stopMcpServer,
} from '@/lib/api/mcp'
import { getErrorMessage } from '@/lib/error-utils'
import type { McpServer, McpServerStatus } from '@/types/mcp'

interface NewServerInput {
  name: string
  command: string
  args: string[]
}

interface McpStore {
  servers: McpServer[]
  loading: boolean
  initialized: boolean
  error: string | null

  init: () => Promise<void>
  refresh: () => Promise<void>
  addServer: (server: NewServerInput) => Promise<string>
  removeServer: (id: string) => Promise<void>
  connectServer: (id: string) => Promise<void>
  disconnectServer: (id: string) => Promise<void>
  setServerStatus: (id: string, status: McpServerStatus) => void
}

export const useMcpStore = create<McpStore>()((set, get) => ({
  servers: [],
  loading: false,
  initialized: false,
  error: null,

  init: async () => {
    if (get().initialized || get().loading) return
    await get().refresh()
  },

  refresh: async () => {
    set({ loading: true, error: null })
    try {
      const servers = await hydrateMcpServers()
      set({ servers, initialized: true })
    } catch (error) {
      set({
        error: getErrorMessage(error, 'Failed to load MCP servers'),
        initialized: true,
      })
    } finally {
      set({ loading: false })
    }
  },

  addServer: async (server) => {
    const id = crypto.randomUUID()

    await addMcpServer({
      id,
      name: server.name,
      command: server.command,
      args: server.args,
    })

    await get().refresh()
    return id
  },

  removeServer: async (id) => {
    await removeMcpServer(id)
    await get().refresh()
  },

  connectServer: async (id) => {
    get().setServerStatus(id, 'connecting')

    try {
      await startMcpServer(id)
      await get().refresh()
    } catch (error) {
      set({ error: getErrorMessage(error, 'Failed to connect MCP server') })
      get().setServerStatus(id, 'error')
    }
  },

  disconnectServer: async (id) => {
    try {
      await stopMcpServer(id)
      await get().refresh()
    } catch (error) {
      set({ error: getErrorMessage(error, 'Failed to disconnect MCP server') })
      get().setServerStatus(id, 'error')
    }
  },

  setServerStatus: (id, status) => {
    set((state) => ({
      servers: state.servers.map((server) =>
        server.id === id
          ? {
              ...server,
              status,
              last_connected:
                status === 'connected'
                  ? new Date().toISOString()
                  : server.last_connected,
            }
          : server
      ),
    }))
  },
}))
