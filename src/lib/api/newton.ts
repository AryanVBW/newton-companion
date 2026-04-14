import { invoke } from '@/lib/tauri'
import { parseCourseList } from '@/lib/newton-parsers'
import { parseToolText } from '@/lib/parse-tool-text'
import type { CourseListItem } from '@/types/newton'

type JsonRecord = Record<string, unknown>

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === 'object' && value !== null
    ? (value as JsonRecord)
    : null
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export interface CachedNewtonDataResponse {
  has_data: boolean
  data?: Record<string, unknown>
  fetched_at?: Record<string, string>
}

export interface NewtonMcpCheckResponse {
  installed: boolean
  authenticated: boolean
  has_saved_session?: boolean
}

export interface NewtonMcpStatusResponse {
  authenticated: boolean
  expires?: string
  saved_name?: string
  saved_email?: string
}

export interface NewtonAutoConnectResponse {
  connected: boolean
  error?: string
}

export interface NewtonLoginStartResponse {
  already_authenticated?: boolean
  code?: string
  url?: string
}

export interface NewtonLoginPollResponse {
  complete: boolean
  success: boolean
}

export interface NewtonProfile {
  name: string
  email: string
}

export async function getCachedNewtonData(): Promise<CachedNewtonDataResponse> {
  return invoke<CachedNewtonDataResponse>('get_cached_newton_data')
}

export async function syncAllNewtonData(
  courseHash?: string | null
): Promise<Record<string, unknown>> {
  return invoke<Record<string, unknown>>('sync_all_newton_data', {
    courseHash: courseHash ?? null,
  })
}

export async function callNewtonTool<T = unknown>(
  toolName: string,
  args: Record<string, unknown> = {}
): Promise<T> {
  return invoke<T>('mcp_call_tool', {
    serverId: 'newton-school',
    toolName,
    args,
  })
}

export async function fetchNewtonProfile(): Promise<NewtonProfile> {
  const result = await callNewtonTool('get_me')
  const parsed = asRecord(parseToolText(result))

  return {
    name: asString(parsed?.name ?? asRecord(parsed?.user)?.name),
    email: asString(parsed?.email ?? asRecord(parsed?.user)?.email),
  }
}

export async function listNewtonCourses(): Promise<CourseListItem[]> {
  const result = await callNewtonTool('list_courses')
  return parseCourseList(result)
}

export async function checkNewtonMcp(): Promise<NewtonMcpCheckResponse> {
  return invoke<NewtonMcpCheckResponse>('check_newton_mcp')
}

export async function installNewtonMcp(): Promise<void> {
  await invoke('install_newton_mcp')
}

export async function getNewtonMcpStatus(): Promise<NewtonMcpStatusResponse> {
  return invoke<NewtonMcpStatusResponse>('newton_mcp_status')
}

export async function autoConnectNewton(): Promise<NewtonAutoConnectResponse> {
  return invoke<NewtonAutoConnectResponse>('auto_connect_newton')
}

export async function startNewtonLogin(): Promise<NewtonLoginStartResponse> {
  return invoke<NewtonLoginStartResponse>('newton_mcp_start_login')
}

export async function pollNewtonLogin(): Promise<NewtonLoginPollResponse> {
  return invoke<NewtonLoginPollResponse>('newton_mcp_poll_login')
}

export async function cancelNewtonLogin(): Promise<void> {
  await invoke('newton_mcp_cancel_login')
}

export async function logoutNewton(): Promise<void> {
  await invoke('newton_mcp_logout')
}
