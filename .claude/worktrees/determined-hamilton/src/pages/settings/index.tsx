import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Sun, Moon, Monitor, Brain, Bell, Calendar, Info,
  ExternalLink, RefreshCw, Unplug, Globe, Sparkles, Terminal,
  Smartphone, Link2, Wifi, WifiOff, Loader2, Copy, CheckCircle2, X,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectItem } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useUiStore } from '@/stores/ui-store'
import { useNewtonAuthStore } from '@/stores/newton-auth-store'
import { AI_PROVIDERS } from '@/lib/constants'
import { cn } from '@/lib/cn'
import { invoke } from '@/lib/tauri'

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

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const

const PROVIDER_ICONS: Record<string, any> = {
  github: GitHubIcon,
  github_copilot: GitHubIcon,
  claude: ClaudeIcon,
  openrouter: Globe,
  gemini: Sparkles,
  custom: Terminal,
}

function SettingsPage() {
  const theme = useUiStore((s) => s.theme)
  const setTheme = useUiStore((s) => s.setTheme)
  const authenticated = useNewtonAuthStore((s) => s.authenticated)
  const connectStatus = useNewtonAuthStore((s) => s.connectStatus)
  const connectError = useNewtonAuthStore((s) => s.connectError)
  const deviceCode = useNewtonAuthStore((s) => s.deviceCode)
  const deviceUrl = useNewtonAuthStore((s) => s.deviceUrl)
  const terminalLines = useNewtonAuthStore((s) => s.terminalLines)
  const fullConnect = useNewtonAuthStore((s) => s.fullConnect)
  const startLogin = useNewtonAuthStore((s) => s.startLogin)
  const cancelLogin = useNewtonAuthStore((s) => s.cancelLogin)
  const logout = useNewtonAuthStore((s) => s.logout)
  const linkedAt = useNewtonAuthStore((s) => s.linkedAt)
  const [selectedProvider, setSelectedProvider] = useState('github_copilot')
  const [selectedModel, setSelectedModel] = useState('gpt-4.1')
  const [apiKey, setApiKey] = useState('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [googleConnected, setGoogleConnected] = useState(false)
  const [syncLectures, setSyncLectures] = useState(true)
  const [syncContests, setSyncContests] = useState(true)
  const [syncAssignments, setSyncAssignments] = useState(true)
  const [syncAssessments, setSyncAssessments] = useState(false)
  const [emailNotify, setEmailNotify] = useState(true)
  const [notifyUpcoming, setNotifyUpcoming] = useState(true)
  const [notifyDeadlines, setNotifyDeadlines] = useState(true)
  const [notifyQotd, setNotifyQotd] = useState(true)
  const [googleClientId, setGoogleClientId] = useState('')
  const [googleClientSecret, setGoogleClientSecret] = useState('')

  useEffect(() => {
    invoke<any>('ai_get_config').then((config) => {
      if (config?.provider) setSelectedProvider(config.provider)
      if (config?.model_id) setSelectedModel(config.model_id)
      // never pre-fill apiKey for security
    }).catch(() => {})
  }, [])

  const provider = AI_PROVIDERS.find((p) => p.id === selectedProvider)
  const providerModels = provider?.models ?? []
  const Icon = PROVIDER_ICONS[selectedProvider] || Brain

  return (
    <ScrollArea className="h-full">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="p-6 space-y-6 max-w-2xl"
      >
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            Configure your Newton Companion experience.
          </p>
        </div>

        {/* Appearance */}
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-4">
              Appearance
            </h3>
            <div className="flex gap-2">
              {THEME_OPTIONS.map(({ value, label, icon: ThIcon }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value as any)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border-2 transition-all text-sm font-medium',
                    theme === value
                      ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5 text-[hsl(var(--primary))]'
                      : 'border-[hsl(var(--border))] hover:border-[hsl(var(--muted-foreground))]'
                  )}
                >
                  <ThIcon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Device Link */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                <h3 className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                  Newton School Device
                </h3>
              </div>
              <Badge variant={authenticated ? 'default' : 'outline'}>
                {authenticated ? 'Linked' : 'Not Linked'}
              </Badge>
            </div>

            {authenticated ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                  <Wifi className="h-5 w-5 text-green-500" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Authenticated</p>
                    {linkedAt && (
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">Linked {new Date(linkedAt).toLocaleDateString()}</p>
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-red-500 hover:text-red-600"
                  onClick={logout}
                >
                  <Unplug className="w-3.5 h-3.5" />
                  Logout
                </Button>
              </div>
            ) : connectStatus === 'waiting_for_auth' ? (
              <div className="space-y-3">
                <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/20 text-center space-y-3">
                  <p className="text-sm font-medium">Enter this code on the activation page:</p>
                  <div className="flex items-center justify-center gap-2">
                    <span className="font-mono text-3xl font-black tracking-[0.3em] select-all bg-[hsl(var(--card))] px-4 py-2 rounded-lg border border-[hsl(var(--border))]">
                      {deviceCode}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (deviceCode) navigator.clipboard.writeText(deviceCode)
                      }}
                      className="gap-1"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copy
                    </Button>
                  </div>
                  {deviceUrl && (
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={() => window.open(deviceUrl, '_blank')}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open Activation Page
                    </Button>
                  )}

                  {/* Terminal output */}
                  {terminalLines && terminalLines.length > 0 && (
                    <div className="w-full rounded-lg bg-[#1a1a2e] border border-[#2a2a4a] p-2 text-left max-h-24 overflow-y-auto mt-2">
                      {terminalLines.map((line, i) => (
                        <p key={i} className="text-[11px] font-mono text-gray-300 leading-4">
                          {line || '\u00A0'}
                        </p>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Waiting for authorization...
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="w-full gap-1.5" onClick={cancelLogin}>
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </Button>
              </div>
            ) : connectStatus === 'starting_login' || connectStatus === 'starting_server' || connectStatus === 'fetching_profile' ? (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2 p-4 text-sm text-[hsl(var(--muted-foreground))]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {connectStatus === 'starting_login' ? 'Starting login...' :
                   connectStatus === 'starting_server' ? 'Starting MCP server...' :
                   'Fetching your data...'}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  Sign in to your Newton School account to sync your real course data, lectures, and assignments.
                </p>
                <Button
                  className="w-full gap-2"
                  onClick={async () => {
                    if (connectStatus === 'idle') await fullConnect()
                    else startLogin()
                  }}
                  disabled={connectStatus === 'checking_mcp' || connectStatus === 'installing_mcp'}
                >
                  {(connectStatus === 'checking_mcp' || connectStatus === 'installing_mcp') ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Link2 className="h-4 w-4" />
                  )}
                  Sign in to Newton School
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Brain */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
              <h3 className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                AI Brain
              </h3>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Provider</label>
              <div className="grid grid-cols-3 gap-2">
                {AI_PROVIDERS.map((p) => {
                  const PIcon = PROVIDER_ICONS[p.id] || Brain
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelectedProvider(p.id)
                        setSelectedModel(p.models[0] || '')
                      }}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all',
                        selectedProvider === p.id
                          ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5 text-[hsl(var(--primary))]'
                          : 'border-[hsl(var(--border))] hover:border-[hsl(var(--primary))]/30'
                      )}
                    >
                      <PIcon className="w-3.5 h-3.5" />
                      {p.name}
                    </button>
                  )
                })}
              </div>
            </div>

            {selectedProvider && (
              <>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Model</label>
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    {providerModels.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5" />
                    {provider?.keyLabel || 'API Key'}
                  </label>
                  <Input
                    type="password"
                    placeholder={provider?.keyHint || 'Enter API key'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                </div>
                <Button
                  size="sm"
                  className="w-full"
                  disabled={!apiKey.trim() || saveStatus === 'saving'}
                  onClick={async () => {
                    setSaveStatus('saving')
                    try {
                      await invoke('ai_configure', {
                        provider: selectedProvider,
                        baseUrl: '',
                        apiKey: apiKey.trim(),
                        modelId: selectedModel,
                      })
                      setSaveStatus('saved')
                      setTimeout(() => setSaveStatus('idle'), 3000)
                    } catch {
                      setSaveStatus('error')
                      setTimeout(() => setSaveStatus('idle'), 4000)
                    }
                  }}
                >
                  {saveStatus === 'saving' && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                  {saveStatus === 'saved' && <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-green-400" />}
                  {saveStatus === 'error' && <X className="w-3.5 h-3.5 mr-1.5 text-red-400" />}
                  {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved!' : saveStatus === 'error' ? 'Save failed' : 'Save AI Configuration'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Google Calendar */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                <h3 className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                  Google Calendar
                </h3>
              </div>
              <Badge variant={googleConnected ? 'default' : 'outline'}>
                {googleConnected ? 'Connected' : 'Not Connected'}
              </Badge>
            </div>

            {!googleConnected ? (
              <div className="space-y-3">
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  Connect Google Calendar to auto-sync lectures, contests, and assignment deadlines with email reminders.
                </p>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Google Client ID</label>
                  <Input placeholder="OAuth Client ID" value={googleClientId} onChange={(e) => setGoogleClientId(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Google Client Secret</label>
                  <Input type="password" placeholder="OAuth Client Secret" value={googleClientSecret} onChange={(e) => setGoogleClientSecret(e.target.value)} />
                </div>
                <Button className="w-full gap-2" onClick={() => setGoogleConnected(true)}>
                  <ExternalLink className="w-4 h-4" />
                  Connect Google Calendar
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <Separator />
                <h4 className="text-sm font-medium">What to sync</h4>
                <div className="space-y-3">
                  {[
                    { label: 'Lectures', color: 'bg-blue-500', checked: syncLectures, onChange: setSyncLectures },
                    { label: 'Contests', color: 'bg-red-500', checked: syncContests, onChange: setSyncContests },
                    { label: 'Assignment Deadlines', color: 'bg-orange-500', checked: syncAssignments, onChange: setSyncAssignments },
                    { label: 'Assessments', color: 'bg-purple-500', checked: syncAssessments, onChange: setSyncAssessments },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={cn('w-2.5 h-2.5 rounded-full', item.color)} />
                        <span className="text-sm">{item.label}</span>
                      </div>
                      <Switch checked={item.checked} onCheckedChange={item.onChange} />
                    </div>
                  ))}
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm">Email reminder (30 min before)</span>
                  <Switch checked={emailNotify} onCheckedChange={setEmailNotify} />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 gap-2">
                    <RefreshCw className="w-3.5 h-3.5" />Sync Now
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2 text-red-500 hover:text-red-600" onClick={() => setGoogleConnected(false)}>
                    <Unplug className="w-3.5 h-3.5" />Disconnect
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
              <h3 className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Notifications</h3>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Upcoming lectures (10 min before)', checked: notifyUpcoming, onChange: setNotifyUpcoming },
                { label: 'Assignment deadlines', checked: notifyDeadlines, onChange: setNotifyDeadlines },
                { label: 'Daily QOTD reminder', checked: notifyQotd, onChange: setNotifyQotd },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-sm">{item.label}</span>
                  <Switch checked={item.checked} onCheckedChange={item.onChange} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* About */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
              <h3 className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">About</h3>
            </div>
            <div className="space-y-1 text-sm text-[hsl(var(--muted-foreground))]">
              <p>Newton Companion v0.1.0</p>
              <p>Built with Tauri + React + MCP</p>
              <p>Powered by @newtonschool/newton-mcp</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </ScrollArea>
  )
}

export { SettingsPage }
