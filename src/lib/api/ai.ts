import { invoke } from '@/lib/tauri'
import type { BrainGoal, BrainStatus } from '@/stores/brain-store'

export interface AiChatToolCall {
  id: string
  function: {
    name: string
    arguments: string
  }
}

export interface AiChatHistoryMessage {
  role: string
  tool_calls?: AiChatToolCall[]
  tool_call_id?: string
  content?: string
}

export interface AiChatResponse {
  response: string
  messages: AiChatHistoryMessage[]
  tool_server_map?: Record<string, string>
}

export interface AiConfigResponse {
  provider: string
  base_url: string
  api_key: string
  model_id: string
  temperature: number
  has_key: boolean
}

export async function aiChat(
  message: string,
  history?: AiChatHistoryMessage[] | null
): Promise<AiChatResponse> {
  return invoke<AiChatResponse>('ai_chat', {
    message,
    history: history && history.length > 0 ? history : null,
  })
}

export async function getAiConfig(): Promise<AiConfigResponse> {
  return invoke<AiConfigResponse>('ai_get_config')
}

export async function configureAi(config: {
  provider: string
  baseUrl: string
  apiKey: string
  modelId: string
}): Promise<void> {
  await invoke('ai_configure', config)
}

export async function executeBrainGoal(
  goal: string,
  context?: string
): Promise<{ success: boolean; result: string }> {
  return invoke<{ success: boolean; result: string }>('brain_execute_goal', {
    goal,
    context,
  })
}

export async function cancelBrainGoal(): Promise<void> {
  await invoke('brain_cancel_goal')
}

export async function getBrainStatus(): Promise<BrainStatus> {
  return invoke<BrainStatus>('brain_get_status')
}

export async function getBrainHistory(
  limit = 20
): Promise<{ goals: BrainGoal[] }> {
  return invoke<{ goals: BrainGoal[] }>('brain_get_history', { limit })
}

export async function clearBrainMemory(category?: string): Promise<void> {
  await invoke('brain_clear_memory', { category })
}
