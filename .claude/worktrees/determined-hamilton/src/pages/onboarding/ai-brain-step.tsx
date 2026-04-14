import { useState } from 'react'
import { motion } from 'framer-motion'
import { Brain, ArrowRight, ArrowLeft, Check, Globe, Sparkles, Terminal, Link2, Copy, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectItem } from '@/components/ui/select'
import { cn } from '@/lib/cn'
import { AI_PROVIDERS } from '@/lib/constants'

interface AiBrainStepProps {
  onNext: () => void
  onBack: () => void
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  )
}

function ClaudeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M4.709 15.955l4.72-2.756.08-.046 2.382-1.39 1.39-.811.576-.337.7-.408.464-.27.14-.083.033-.019L21.523 6.2a.512.512 0 00-.134-.905L12.386.09a.821.821 0 00-.772 0L2.611 5.295a.512.512 0 00-.134.905l2.232 1.303v8.452zm3.834-7.294L12 6.583l3.457 2.078L12 10.738 8.543 8.661zM6.978 16.87L4.709 15.955V9.708l5.12 2.99v7.116l-2.851-2.944zm10.044 0l-2.851 2.944v-7.116l5.12-2.99v6.247l-2.269.915z" />
    </svg>
  )
}

const PROVIDER_ICONS: Record<string, any> = {
  github: GitHubIcon,
  github_copilot: GitHubIcon,
  claude: ClaudeIcon,
  openrouter: Globe,
  gemini: Sparkles,
  custom: Terminal,
}

const PROVIDER_COLORS: Record<string, string> = {
  github_copilot: 'from-blue-500/20 to-purple-500/20 border-blue-500/40',
  github: 'from-gray-500/20 to-gray-400/20 border-gray-400/40',
  claude: 'from-orange-500/20 to-amber-500/20 border-orange-500/40',
  gemini: 'from-blue-500/20 to-cyan-500/20 border-blue-400/40',
  openrouter: 'from-emerald-500/20 to-teal-500/20 border-emerald-400/40',
  custom: 'from-gray-500/20 to-gray-600/20 border-gray-500/40',
}

function AiBrainStep({ onNext, onBack }: AiBrainStepProps) {
  const [selectedProvider, setSelectedProvider] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [copilotLinking, setCopilotLinking] = useState(false)
  const [copilotLinked, setCopilotLinked] = useState(false)
  const [copiedCommand, setCopiedCommand] = useState(false)

  const provider = AI_PROVIDERS.find((p) => p.id === selectedProvider)
  const providerModels = provider?.models ?? []

  const handleCopyCommand = () => {
    navigator.clipboard.writeText('gh auth token')
    setCopiedCommand(true)
    setTimeout(() => setCopiedCommand(false), 2000)
  }

  const handleDeviceLink = () => {
    setCopilotLinking(true)
    // In production, this would open the GitHub device flow
    // For now, simulate the flow
    setTimeout(() => {
      setCopilotLinking(false)
      setCopilotLinked(true)
      setApiKey('linked-via-device-flow')
    }, 2000)
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.2 }}
    >
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 mb-4">
          <Brain className="h-8 w-8 text-purple-400" />
        </div>
        <h2 className="text-2xl font-bold">Set Up Your AI Brain</h2>
        <p className="text-[hsl(var(--muted-foreground))] mt-2 max-w-md mx-auto text-sm leading-relaxed">
          Choose an AI provider to power study recommendations, missed lecture recovery, and smart suggestions.
        </p>
      </div>

      {/* Provider Grid - 3 columns for first row, 3 for second */}
      <div className="grid grid-cols-3 gap-2.5 mb-6">
        {AI_PROVIDERS.map((p) => {
          const Icon = PROVIDER_ICONS[p.id] || Brain
          const colors = PROVIDER_COLORS[p.id] || PROVIDER_COLORS.custom
          const isSelected = selectedProvider === p.id
          return (
            <button
              key={p.id}
              onClick={() => {
                setSelectedProvider(p.id)
                setSelectedModel(p.models[0] || '')
                setApiKey('')
                setCopilotLinked(false)
              }}
              className={cn(
                'relative flex flex-col items-start gap-1 rounded-xl border p-3 transition-all text-left',
                isSelected
                  ? `bg-gradient-to-br ${colors} border-[hsl(var(--primary))]`
                  : 'border-[hsl(var(--border))] hover:border-[hsl(var(--muted-foreground))]/50 bg-[hsl(var(--card))]'
              )}
            >
              {isSelected && (
                <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[hsl(var(--primary))] shadow-lg">
                  <Check className="h-3 w-3 text-white" />
                </div>
              )}
              <div className="flex items-center gap-1.5 w-full">
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="text-xs font-semibold truncate">{p.name}</span>
              </div>
              {p.free && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400 font-semibold uppercase tracking-wide">
                  Free
                </span>
              )}
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] leading-snug line-clamp-2">
                {p.description}
              </p>
            </button>
          )
        })}
      </div>

      {/* Configuration Panel */}
      {selectedProvider && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4 mb-6 p-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]"
        >
          {/* Model Selector */}
          {providerModels.length > 0 && (
            <div className="text-left">
              <label className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-1.5 block">
                Model
              </label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                {providerModels.map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </Select>
            </div>
          )}

          {/* GitHub Copilot - Device Link Flow */}
          {selectedProvider === 'github_copilot' && (
            <div className="text-left space-y-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] block">
                Authentication
              </label>

              {copilotLinked ? (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <Check className="h-4 w-4 text-green-400" />
                  <span className="text-sm text-green-400 font-medium">GitHub Copilot linked successfully</span>
                </div>
              ) : (
                <>
                  <Button
                    onClick={handleDeviceLink}
                    disabled={copilotLinking}
                    className="w-full gap-2 bg-[hsl(var(--foreground))] text-[hsl(var(--background))] hover:bg-[hsl(var(--foreground))]/90"
                  >
                    {copilotLinking ? (
                      <>
                        <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        Waiting for authorization...
                      </>
                    ) : (
                      <>
                        <Link2 className="h-4 w-4" />
                        Link GitHub Device
                      </>
                    )}
                  </Button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-[hsl(var(--border))]" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-[hsl(var(--card))] px-2 text-[hsl(var(--muted-foreground))]">or paste token manually</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Input
                      type="password"
                      placeholder="Paste gh auth token output"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyCommand}
                      className="shrink-0 gap-1.5 text-xs"
                    >
                      {copiedCommand ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copiedCommand ? 'Copied' : 'gh auth token'}
                    </Button>
                  </div>
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                    Run <code className="px-1 py-0.5 rounded bg-[hsl(var(--muted))] font-mono text-[hsl(var(--foreground))]">gh auth token</code> in your terminal, then paste the output above.
                  </p>
                </>
              )}
            </div>
          )}

          {/* Standard API Key Input */}
          {selectedProvider !== 'github_copilot' && (
            <div className="text-left">
              <label className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-1.5 block">
                {provider?.keyLabel || 'API Key'}
              </label>
              <Input
                type="password"
                placeholder={`Enter your ${provider?.name} key`}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1.5">
                {provider?.keyHint || 'Your key is stored locally and never sent to our servers.'}
              </p>
            </div>
          )}

          {/* Custom endpoint URL */}
          {selectedProvider === 'custom' && (
            <div className="text-left">
              <label className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-1.5 block">
                Base URL
              </label>
              <Input
                placeholder="https://api.example.com/v1"
              />
            </div>
          )}
        </motion.div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="gap-2 flex-1">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button onClick={onNext} className="gap-2 flex-1">
          Continue
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      <button
        onClick={onNext}
        className="mt-3 w-full text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors cursor-pointer"
      >
        Skip for now — you can configure this later in Settings
      </button>
    </motion.div>
  )
}

export { AiBrainStep }
