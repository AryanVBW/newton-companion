export interface AiProvider {
  id: string
  name: string
  models: string[]
}

export interface AiConfig {
  provider_id: string
  model: string
  api_key: string
  temperature: number
  max_tokens: number
  system_prompt: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  tool_calls?: ChatToolCall[]
}

export interface ChatToolCall {
  id: string
  tool_name: string
  server_name: string
  arguments: Record<string, unknown>
  result?: string
  is_error?: boolean
  is_loading?: boolean
}

export interface ChatConversation {
  id: string
  title: string
  messages: ChatMessage[]
  created_at: string
  updated_at: string
}
