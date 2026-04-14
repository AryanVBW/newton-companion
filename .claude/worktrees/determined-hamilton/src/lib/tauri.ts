import { invoke as tauriInvoke } from '@tauri-apps/api/core'

export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await tauriInvoke<T>(cmd, args)
  } catch (error) {
    console.error(`Tauri invoke error [${cmd}]:`, error)
    throw error
  }
}
