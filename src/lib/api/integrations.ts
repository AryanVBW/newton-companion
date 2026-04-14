import { invoke } from '@/lib/tauri'

export interface IntegrationStatus {
  google_calendar: { configured: boolean; connected: boolean }
  notion: { configured: boolean; connected: boolean }
  gdocs: { configured: boolean; connected: boolean }
}

export async function getIntegrationStatus(): Promise<IntegrationStatus> {
  return invoke<IntegrationStatus>('get_integration_status')
}

export async function saveIntegration(input: {
  id: string
  provider: string
  apiKey: string
  config: Record<string, unknown> | null
}): Promise<void> {
  await invoke('save_integration', input)
}

export async function removeIntegration(input: {
  id: string
  provider: string
}): Promise<void> {
  await invoke('remove_integration', input)
}

export async function startGoogleAuth(input: {
  clientId: string
  clientSecret: string
}): Promise<string> {
  return invoke<string>('google_auth_start', input)
}

export async function disconnectGoogleAuth(): Promise<void> {
  await invoke('google_auth_disconnect')
}
