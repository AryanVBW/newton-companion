export interface McpServer {
  id: string
  name: string
  command: string
  args: string[]
  env?: Record<string, string>
  status: McpServerStatus
  tools: McpTool[]
  last_connected?: string
}

export type McpServerStatus = 'connected' | 'disconnected' | 'connecting' | 'error'

export interface McpTool {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

export interface McpToolCall {
  server_id: string
  tool_name: string
  arguments: Record<string, unknown>
}

export interface McpToolResult {
  content: string
  is_error: boolean
}
