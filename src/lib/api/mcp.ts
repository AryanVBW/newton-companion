import { invoke } from '@/lib/tauri'
import type { McpServer, McpTool } from '@/types/mcp'

interface RawMcpTool {
  name: string
  description?: string | null
  input_schema?: Record<string, unknown>
}

interface RawMcpServer {
  id: string
  name: string
  command: string
  args?: string[]
  env?: Record<string, string>
  connected?: boolean
}

interface McpServersResponse {
  servers?: RawMcpServer[]
}

interface McpToolsResponse {
  tools?: RawMcpTool[]
}

export interface AddMcpServerInput {
  id: string
  name: string
  command: string
  args: string[]
}

function mapServer(server: RawMcpServer, tools: McpTool[] = []): McpServer {
  return {
    id: server.id,
    name: server.name,
    command: server.command,
    args: server.args ?? [],
    env: server.env,
    status: server.connected ? 'connected' : 'disconnected',
    tools,
    last_connected: server.connected ? new Date().toISOString() : undefined,
  }
}

function mapTool(tool: RawMcpTool): McpTool {
  return {
    name: tool.name,
    description: tool.description ?? '',
    input_schema: tool.input_schema ?? {},
  }
}

export async function listMcpServers(): Promise<McpServer[]> {
  const result = await invoke<McpServersResponse>('mcp_list_servers')
  return (result.servers ?? []).map((server) => mapServer(server))
}

export async function listMcpTools(serverId: string): Promise<McpTool[]> {
  const result = await invoke<McpToolsResponse>('mcp_list_tools', { serverId })
  return (result.tools ?? []).map(mapTool)
}

export async function hydrateMcpServers(): Promise<McpServer[]> {
  const servers = await listMcpServers()

  const toolEntries = await Promise.all(
    servers
      .filter((server) => server.status === 'connected')
      .map(async (server) => [server.id, await listMcpTools(server.id)] as const)
  )

  const toolsByServer = new Map(toolEntries)

  return servers.map((server) => ({
    ...server,
    tools: toolsByServer.get(server.id) ?? [],
  }))
}

export async function addMcpServer(config: AddMcpServerInput): Promise<void> {
  await invoke('mcp_add_server', {
    config: {
      id: config.id,
      name: config.name,
      transport_type: 'stdio',
      command: config.command,
      args: config.args,
      env: {},
      enabled: true,
    },
  })
}

export async function removeMcpServer(serverId: string): Promise<void> {
  await invoke('mcp_remove_server', { serverId })
}

export async function startMcpServer(serverId: string): Promise<void> {
  await invoke('mcp_start_server', { serverId })
}

export async function stopMcpServer(serverId: string): Promise<void> {
  await invoke('mcp_stop_server', { serverId })
}
