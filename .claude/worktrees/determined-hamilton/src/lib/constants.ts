export const APP_NAME = 'Newton Companion'
export const APP_VERSION = '0.1.0'

export const SIDEBAR_WIDTH = 240
export const TITLEBAR_HEIGHT = 52

export const AI_PROVIDERS = [
  {
    id: 'github_copilot',
    name: 'GitHub Copilot',
    description: 'Free with Copilot subscription. Link via GitHub CLI device flow.',
    models: ['gpt-4.1', 'gpt-4o', 'claude-sonnet-4', 'o4-mini', 'gemini-2.5-flash'],
    keyLabel: 'Copilot Token',
    keyHint: 'Click "Link Device" to authenticate via GitHub CLI',
    free: true,
    authType: 'device' as const,
  },
  {
    id: 'github',
    name: 'GitHub Models',
    description: 'Free with any GitHub account. GPT, Llama, Mistral & more.',
    models: ['gpt-4.1', 'gpt-4o', 'gpt-4o-mini', 'Meta-Llama-3.3-70B-Instruct', 'Mistral-Large-2501'],
    keyLabel: 'GitHub Personal Access Token',
    keyHint: 'Generate at github.com/settings/tokens',
    free: true,
    authType: 'key' as const,
  },
  {
    id: 'claude',
    name: 'Claude (Anthropic)',
    description: 'Anthropic Claude models. Best for reasoning & code.',
    models: ['claude-sonnet-4-20250514', 'claude-haiku-4-5-20251001', 'claude-opus-4-20250514'],
    keyLabel: 'Anthropic API Key',
    keyHint: 'Get at console.anthropic.com/settings/keys',
    free: false,
    authType: 'key' as const,
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Free tier available. Gemini 2.5 with thinking.',
    models: ['gemini-2.5-flash-preview-05-20', 'gemini-2.5-pro-preview-05-06', 'gemini-2.0-flash'],
    keyLabel: 'Gemini API Key',
    keyHint: 'Get at aistudio.google.com/apikey',
    free: true,
    authType: 'key' as const,
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'Unified gateway to all AI providers. Some models free.',
    models: ['openai/gpt-4.1', 'anthropic/claude-sonnet-4', 'google/gemini-2.5-flash-preview', 'meta-llama/llama-4-maverick'],
    keyLabel: 'OpenRouter API Key',
    keyHint: 'Get at openrouter.ai/keys',
    free: false,
    authType: 'key' as const,
  },
  {
    id: 'custom',
    name: 'Custom Endpoint',
    description: 'Any OpenAI-compatible API endpoint.',
    models: [],
    keyLabel: 'API Key',
    keyHint: 'Enter the API key for your custom endpoint',
    free: false,
    authType: 'key' as const,
  },
] as const

export const LECTURE_STATUS_COLORS = {
  attended: 'success',
  missed: 'destructive',
  upcoming: 'primary',
  recording: 'muted',
} as const

export const DIFFICULTY_COLORS = {
  easy: 'success',
  medium: 'warning',
  hard: 'destructive',
} as const
