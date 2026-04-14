import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sun, Moon, Monitor, Brain, Calendar, Info,
  ExternalLink, RefreshCw, Unplug, Globe, Sparkles, Terminal,
  Smartphone, Link2, Loader2, Copy, X,
  Palette, Shield, Cpu, BellDot, LayoutGrid,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectItem } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { useUiStore } from '@/stores/ui-store'
import { useNewtonAuthStore } from '@/stores/newton-auth-store'
import { AI_PROVIDERS } from '@/lib/constants'
import { configureAi, getAiConfig } from '@/lib/api/ai'
import { cn } from '@/lib/cn'
import { getErrorMessage } from '@/lib/error-utils'
import { LogoIcon, LogoWordmark } from '@/components/newton-logo'

/* ── tiny brand icons ─────────────────────────────────────── */
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

const PROVIDER_ICONS: Record<string, React.ElementType> = {
  github: GitHubIcon,
  github_copilot: GitHubIcon,
  claude: ClaudeIcon,
  openrouter: Globe,
  gemini: Sparkles,
  custom: Terminal,
}

/* ── Settings sidebar nav ─────────────────────────────────── */
type SettingsSection = 'appearance' | 'account' | 'ai' | 'integrations' | 'notifications' | 'about'

const SECTIONS: { id: SettingsSection; label: string; icon: React.ElementType; badge?: string }[] = [
  { id: 'appearance',    label: 'Appearance',    icon: Palette },
  { id: 'account',       label: 'Account',       icon: Shield },
  { id: 'ai',            label: 'AI Brain',      icon: Cpu },
  { id: 'integrations',  label: 'Integrations',  icon: LayoutGrid },
  { id: 'notifications', label: 'Notifications', icon: BellDot },
  { id: 'about',         label: 'About',         icon: Info },
]

/* ── shared section wrapper ────────────────────────────────── */
function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <div className="pb-4" style={{ borderBottom: '1px solid hsl(var(--border))' }}>
        <h2 className="text-[17px] font-semibold tracking-tight">{title}</h2>
        {description && (
          <p className="text-[13px] mt-1" style={{ color: 'hsl(var(--muted-foreground))' }}>{description}</p>
        )}
      </div>
      {children}
    </div>
  )
}

/* ── row component ─────────────────────────────────────────── */
function Row({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 py-3" style={{ borderBottom: '1px solid hsl(var(--border)/0.5)' }}>
      <div className="min-w-0">
        <p className="text-[13.5px] font-medium">{label}</p>
        {description && (
          <p className="text-[12px] mt-0.5 leading-relaxed" style={{ color: 'hsl(var(--muted-foreground))' }}>{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

/* ── Appearance section ────────────────────────────────────── */
function AppearanceSection() {
  const theme = useUiStore((s) => s.theme)
  const setTheme = useUiStore((s) => s.setTheme)
  const THEMES = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark',  label: 'Dark',  icon: Moon },
    { value: 'system',label: 'System',icon: Monitor },
  ] as const

  return (
    <Section title="Appearance" description="Customise how Newton Companion looks on your device.">
      <Row label="Theme" description="Choose a colour scheme for the interface.">
        <div className="flex gap-1.5">
          {THEMES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-medium transition-all border',
                theme === value
                  ? 'text-[#78C7CE] border-[rgba(120,199,206,0.4)] bg-[rgba(120,199,206,0.08)]'
                  : 'border-transparent hover:border-[hsl(var(--border))]'
              )}
              style={{ color: theme === value ? '#78C7CE' : 'hsl(var(--muted-foreground))' }}
            >
              <Icon style={{ width: 13, height: 13 }} />
              {label}
            </button>
          ))}
        </div>
      </Row>
    </Section>
  )
}

/* ── Account section ───────────────────────────────────────── */
function AccountSection() {
  const authenticated  = useNewtonAuthStore((s) => s.authenticated)
  const connectStatus  = useNewtonAuthStore((s) => s.connectStatus)
  const connectError   = useNewtonAuthStore((s) => s.connectError)
  const deviceCode     = useNewtonAuthStore((s) => s.deviceCode)
  const deviceUrl      = useNewtonAuthStore((s) => s.deviceUrl)
  const terminalLines  = useNewtonAuthStore((s) => s.terminalLines)
  const fullConnect    = useNewtonAuthStore((s) => s.fullConnect)
  const startLogin     = useNewtonAuthStore((s) => s.startLogin)
  const cancelLogin    = useNewtonAuthStore((s) => s.cancelLogin)
  const logout         = useNewtonAuthStore((s) => s.logout)
  const linkedAt       = useNewtonAuthStore((s) => s.linkedAt)
  const userName       = useNewtonAuthStore((s) => s.userName)
  const userEmail      = useNewtonAuthStore((s) => s.userEmail)
  const [copied, setCopied] = useState(false)

  const copyCode = () => {
    if (deviceCode) { navigator.clipboard.writeText(deviceCode); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  }

  const isBusy = connectStatus === 'checking_mcp' || connectStatus === 'installing_mcp'
    || connectStatus === 'starting_login' || connectStatus === 'starting_server' || connectStatus === 'fetching_profile'

  return (
    <Section title="Newton School Account" description="Link your Newton School account to sync course data.">
      {authenticated ? (
        <div className="space-y-4">
          {/* Connected card */}
          <div
            className="flex items-center gap-4 p-4 rounded-xl"
            style={{ background: 'rgba(132,206,191,0.07)', border: '1px solid rgba(132,206,191,0.2)' }}
          >
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl text-lg font-bold shrink-0"
              style={{ background: 'linear-gradient(135deg,#78C7CE,#7E9ACF)', color: '#fff' }}
            >
              {(userName || 'S')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold truncate">{userName || 'Newton Student'}</p>
              {userEmail && <p className="text-[12px] truncate" style={{ color: 'hsl(var(--muted-foreground))' }}>{userEmail}</p>}
              {linkedAt && (
                <p className="text-[11px] mt-0.5" style={{ color: 'rgba(120,199,206,0.7)' }}>
                  Linked {new Date(linkedAt).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}
                </p>
              )}
            </div>
            <div className="flex h-2 w-2 rounded-full" style={{ background: '#84CEBF', boxShadow: '0 0 6px #84CEBF' }} />
          </div>

          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={logout}
            style={{ color: 'hsl(var(--destructive))', borderColor: 'hsl(var(--destructive)/0.3)' }}
          >
            <Unplug style={{ width: 13, height: 13 }} />
            Sign Out
          </Button>
        </div>
      ) : connectStatus === 'waiting_for_auth' ? (
        <div className="space-y-4">
          <div
            className="rounded-xl p-5 text-center space-y-4"
            style={{ background: 'rgba(120,199,206,0.05)', border: '1px solid rgba(120,199,206,0.15)' }}
          >
            <p className="text-[13px] font-medium">Enter this code at the activation page</p>
            <div className="flex items-center justify-center gap-3">
              <span
                className="font-mono text-[28px] font-black tracking-[0.25em] px-5 py-2.5 rounded-xl select-all"
                style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', color: '#78C7CE' }}
              >
                {deviceCode}
              </span>
              <button
                onClick={copyCode}
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-[12px] font-medium transition-colors"
                style={{ background: copied ? 'rgba(132,206,191,0.15)' : 'hsl(var(--secondary))', color: copied ? '#84CEBF' : 'hsl(var(--foreground))' }}
              >
                {copied ? <><span>✓</span> Copied</> : <><Copy style={{ width: 12, height: 12 }} /> Copy</>}
              </button>
            </div>
            {deviceUrl && (
              <Button size="sm" className="gap-1.5" onClick={() => window.open(deviceUrl, '_blank')}>
                <ExternalLink style={{ width: 13, height: 13 }} />
                Open Activation Page
              </Button>
            )}
            {terminalLines && terminalLines.length > 0 && (
              <div
                className="rounded-lg p-3 text-left max-h-20 overflow-y-auto text-[11px] font-mono leading-4"
                style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.06)', color: '#8b949e' }}
              >
                {terminalLines.map((l, i) => <p key={i}>{l || '\u00A0'}</p>)}
              </div>
            )}
            <div className="flex items-center justify-center gap-2 text-[12px]" style={{ color: 'hsl(var(--muted-foreground))' }}>
              <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" />
              Waiting for authorisation…
            </div>
          </div>
          <Button variant="ghost" size="sm" className="w-full gap-1.5" onClick={cancelLogin}>
            <X style={{ width: 13, height: 13 }} /> Cancel
          </Button>
        </div>
      ) : isBusy ? (
        <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: 'hsl(var(--secondary))' }}>
          <Loader2 style={{ width: 16, height: 16, color: '#78C7CE' }} className="animate-spin shrink-0" />
          <p className="text-[13px]">
            {connectStatus === 'starting_login' ? 'Starting login…'
              : connectStatus === 'starting_server' ? 'Starting MCP server…'
              : 'Fetching your data…'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {connectError && (
            <div className="p-3 rounded-lg text-[12.5px]" style={{ background: 'hsl(var(--destructive)/0.08)', color: 'hsl(var(--destructive))', border: '1px solid hsl(var(--destructive)/0.2)' }}>
              {connectError}
            </div>
          )}
          <div
            className="flex items-center gap-4 p-4 rounded-xl"
            style={{ background: 'hsl(var(--secondary))', border: '1px solid hsl(var(--border))' }}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full shrink-0" style={{ background: 'hsl(var(--muted))' }}>
              <Smartphone style={{ width: 18, height: 18, color: 'hsl(var(--muted-foreground))' }} />
            </div>
            <div>
              <p className="text-[13.5px] font-medium">Not Signed In</p>
              <p className="text-[12px] mt-0.5" style={{ color: 'hsl(var(--muted-foreground))' }}>
                Sign in to sync lectures, assignments & leaderboard.
              </p>
            </div>
          </div>
          <Button
            className="w-full gap-2"
            onClick={async () => { if (connectStatus === 'idle') await fullConnect(); else startLogin() }}
          >
            <Link2 style={{ width: 14, height: 14 }} />
            Sign in to Newton School
          </Button>
        </div>
      )}
    </Section>
  )
}

/* ── AI Brain section ──────────────────────────────────────── */
function AiSection() {
  const [selectedProvider, setSelectedProvider] = useState('claude')
  const [selectedModel,    setSelectedModel]    = useState('claude-haiku-4-5-20251001')
  const [apiKey,           setApiKey]           = useState('')
  const [saved,            setSaved]            = useState(false)
  const [saving,           setSaving]           = useState(false)
  const [saveError,        setSaveError]        = useState<string | null>(null)
  const [hasKey,           setHasKey]           = useState(false)

  // Load current config from backend on mount
  useEffect(() => {
    getAiConfig().then((cfg) => {
      if (cfg?.provider) {
        setSelectedProvider(cfg.provider)
        setSelectedModel(cfg.model_id || '')
        setHasKey(cfg.has_key || false)
      }
    }).catch(() => undefined)
  }, [])

  const provider = AI_PROVIDERS.find((p) => p.id === selectedProvider)
  const Icon     = PROVIDER_ICONS[selectedProvider] || Brain

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      await configureAi({
        provider: selectedProvider,
        baseUrl: '',
        apiKey,
        modelId: selectedModel,
      })
      setSaved(true)
      if (apiKey) setHasKey(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (error) {
      setSaveError(getErrorMessage(error, 'Could not save AI settings'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Section title="AI Brain" description="Choose the AI provider and model that powers your assistant.">
      <div className="space-y-5">
        {/* Provider grid */}
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'hsl(var(--muted-foreground))' }}>Provider</p>
          <div className="grid grid-cols-3 gap-2">
            {AI_PROVIDERS.map((p) => {
              const PIcon = PROVIDER_ICONS[p.id] || Brain
              const active = selectedProvider === p.id
              return (
                <button
                  key={p.id}
                  onClick={() => { setSelectedProvider(p.id); setSelectedModel(p.models[0] || '') }}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-[12.5px] font-medium transition-all"
                  style={{
                    background: active ? 'rgba(120,199,206,0.08)' : 'hsl(var(--secondary))',
                    border: `1px solid ${active ? 'rgba(120,199,206,0.35)' : 'hsl(var(--border))'}`,
                    color: active ? '#78C7CE' : 'hsl(var(--muted-foreground))',
                  }}
                >
                  <PIcon style={{ width: 14, height: 14 }} />
                  {p.name}
                </button>
              )
            })}
          </div>
        </div>

        {/* Model selector */}
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'hsl(var(--muted-foreground))' }}>Model</p>
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            {(provider?.models ?? []).map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </Select>
        </div>

        {/* API Key */}
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: 'hsl(var(--muted-foreground))' }}>
            <Icon style={{ width: 12, height: 12 }} />
            {provider?.keyLabel || 'API Key'}
          </p>
          <Input
            type="password"
            placeholder={hasKey ? '••••••••••••••••' : (provider?.keyHint || 'Enter API key…')}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          {hasKey && !apiKey && (
            <p className="text-[11.5px] mt-1.5" style={{ color: 'rgba(120,199,206,0.8)' }}>
              ✓ API key is configured. Enter a new key to update it.
            </p>
          )}
        </div>

        {saveError && (
          <p className="text-[12px] px-3 py-2 rounded-lg" style={{ background: 'hsl(var(--destructive)/0.08)', color: 'hsl(var(--destructive))', border: '1px solid hsl(var(--destructive)/0.2)' }}>
            {saveError}
          </p>
        )}

        <Button
          size="sm"
          className="gap-2"
          onClick={handleSave}
          disabled={saving || (!apiKey && !hasKey)}
        >
          {saving ? (
            <><Loader2 style={{ width: 13, height: 13 }} className="animate-spin" /> Saving…</>
          ) : saved ? '✓ Saved!' : 'Save Configuration'}
        </Button>
      </div>
    </Section>
  )
}

/* ── Integrations (Google Calendar) ────────────────────────── */
function IntegrationsSection() {
  const [connected,        setConnected]        = useState(false)
  const [googleClientId,   setGoogleClientId]   = useState('')
  const [googleClientSecret, setGoogleClientSecret] = useState('')
  const [syncLectures,     setSyncLectures]     = useState(true)
  const [syncContests,     setSyncContests]     = useState(true)
  const [syncAssignments,  setSyncAssignments]  = useState(true)
  const [syncAssessments,  setSyncAssessments]  = useState(false)
  const [emailNotify,      setEmailNotify]      = useState(true)

  return (
    <Section title="Integrations" description="Connect external services to enhance your workflow.">
      {/* Google Calendar card */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid hsl(var(--border))' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ background: 'hsl(var(--secondary))' }}>
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ background: 'rgba(251,188,5,0.12)', border: '1px solid rgba(251,188,5,0.2)' }}
            >
              <Calendar style={{ width: 16, height: 16, color: '#fbbc05' }} />
            </div>
            <div>
              <p className="text-[13.5px] font-semibold">Google Calendar</p>
              <p className="text-[11.5px]" style={{ color: 'hsl(var(--muted-foreground))' }}>
                Sync lectures, deadlines & contests
              </p>
            </div>
          </div>
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-medium"
            style={{
              background: connected ? 'rgba(132,206,191,0.12)' : 'hsl(var(--muted))',
              color: connected ? '#84CEBF' : 'hsl(var(--muted-foreground))',
              border: `1px solid ${connected ? 'rgba(132,206,191,0.25)' : 'hsl(var(--border))'}`,
            }}
          >
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: connected ? '#84CEBF' : 'hsl(var(--muted-foreground))' }} />
            {connected ? 'Connected' : 'Not Connected'}
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {!connected ? (
            <>
              <p className="text-[12.5px]" style={{ color: 'hsl(var(--muted-foreground))' }}>
                Connect Google Calendar to automatically sync your Newton schedule with email reminders.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-[12px] font-medium mb-1.5">Client ID</label>
                  <Input placeholder="OAuth 2.0 Client ID" value={googleClientId} onChange={(e) => setGoogleClientId(e.target.value)} />
                </div>
                <div>
                  <label className="block text-[12px] font-medium mb-1.5">Client Secret</label>
                  <Input type="password" placeholder="OAuth 2.0 Client Secret" value={googleClientSecret} onChange={(e) => setGoogleClientSecret(e.target.value)} />
                </div>
              </div>
              <Button className="w-full gap-2" onClick={() => setConnected(true)}>
                <ExternalLink style={{ width: 14, height: 14 }} />
                Connect Google Calendar
              </Button>
            </>
          ) : (
            <div className="space-y-4">
              <p className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: 'hsl(var(--muted-foreground))' }}>What to sync</p>
              {[
                { label: 'Lectures',            color: '#7E9ACF', v: syncLectures,    s: setSyncLectures },
                { label: 'Contests',            color: '#f87171', v: syncContests,    s: setSyncContests },
                { label: 'Assignment Deadlines',color: '#fb923c', v: syncAssignments, s: setSyncAssignments },
                { label: 'Assessments',         color: '#a78bfa', v: syncAssessments, s: setSyncAssessments },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                    <span className="text-[13px]">{item.label}</span>
                  </div>
                  <Switch checked={item.v} onCheckedChange={item.s} />
                </div>
              ))}
              <div className="h-px" style={{ background: 'hsl(var(--border))' }} />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-medium">Email reminder</p>
                  <p className="text-[11.5px]" style={{ color: 'hsl(var(--muted-foreground))' }}>30 minutes before events</p>
                </div>
                <Switch checked={emailNotify} onCheckedChange={setEmailNotify} />
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" className="flex-1 gap-1.5">
                  <RefreshCw style={{ width: 12, height: 12 }} /> Sync Now
                </Button>
                <Button
                  variant="outline" size="sm" className="gap-1.5"
                  onClick={() => setConnected(false)}
                  style={{ color: 'hsl(var(--destructive))', borderColor: 'hsl(var(--destructive)/0.3)' }}
                >
                  <Unplug style={{ width: 12, height: 12 }} /> Disconnect
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Section>
  )
}

/* ── Notifications section ─────────────────────────────────── */
function NotificationsSection() {
  const [upcoming,   setUpcoming]   = useState(true)
  const [deadlines,  setDeadlines]  = useState(true)
  const [qotd,       setQotd]       = useState(true)
  const [arena,      setArena]      = useState(false)

  const items = [
    { label: 'Upcoming lectures',   description: '10 minutes before class starts',     v: upcoming,  s: setUpcoming },
    { label: 'Assignment deadlines',description: 'Reminder when due date is near',     v: deadlines, s: setDeadlines },
    { label: 'Daily QOTD',          description: 'Your morning practice question',     v: qotd,      s: setQotd },
    { label: 'Arena challenges',    description: 'New contest and competition alerts', v: arena,     s: setArena },
  ]

  return (
    <Section title="Notifications" description="Choose which alerts Newton Companion sends you.">
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid hsl(var(--border))' }}>
        {items.map((item, i) => (
          <div
            key={item.label}
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: i < items.length - 1 ? '1px solid hsl(var(--border))' : 'none' }}
          >
            <div>
              <p className="text-[13.5px] font-medium">{item.label}</p>
              <p className="text-[12px] mt-0.5" style={{ color: 'hsl(var(--muted-foreground))' }}>{item.description}</p>
            </div>
            <Switch checked={item.v} onCheckedChange={item.s} />
          </div>
        ))}
      </div>
    </Section>
  )
}

/* ── About section ─────────────────────────────────────────── */
function AboutSection() {
  return (
    <Section title="About">
      <div className="space-y-5">
        {/* App identity card */}
        <div
          className="flex items-center gap-5 p-5 rounded-xl"
          style={{ background: 'hsl(var(--secondary))', border: '1px solid hsl(var(--border))' }}
        >
          <LogoIcon size={52} />
          <div>
            <LogoWordmark height={17} theme="auto" />
            <p className="text-[12.5px] mt-1.5 font-medium">Newton Companion</p>
            <p className="text-[12px]" style={{ color: 'hsl(var(--muted-foreground))' }}>
              Version 0.1.0 · Tauri 2 · React 19
            </p>
          </div>
        </div>

        {/* Info rows */}
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid hsl(var(--border))' }}>
          {[
            { label: 'Runtime',   value: 'Tauri 2 + Rust' },
            { label: 'Frontend',  value: 'React 19 + Vite 8' },
            { label: 'AI Layer',  value: 'MCP (Model Context Protocol)' },
            { label: 'Data',      value: '@newtonschool/newton-mcp' },
          ].map((row, i, arr) => (
            <div
              key={row.label}
              className="flex items-center justify-between px-5 py-3.5"
              style={{ borderBottom: i < arr.length - 1 ? '1px solid hsl(var(--border))' : 'none' }}
            >
              <span className="text-[13px] font-medium">{row.label}</span>
              <span className="text-[12.5px] font-mono" style={{ color: 'hsl(var(--muted-foreground))' }}>{row.value}</span>
            </div>
          ))}
        </div>

        <p className="text-[11.5px] text-center" style={{ color: 'hsl(var(--muted-foreground))' }}>
          Built with ❤️ for Newton School students
        </p>
      </div>
    </Section>
  )
}

/* ── Main SettingsPage ────────────────────────────────────── */
function SettingsPage() {
  const [active, setActive] = useState<SettingsSection>('appearance')

  const renderSection = () => {
    switch (active) {
      case 'appearance':    return <AppearanceSection />
      case 'account':       return <AccountSection />
      case 'ai':            return <AiSection />
      case 'integrations':  return <IntegrationsSection />
      case 'notifications': return <NotificationsSection />
      case 'about':         return <AboutSection />
    }
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Settings sidebar nav ── */}
      <div
        className="w-[200px] shrink-0 flex flex-col py-4 overflow-y-auto"
        style={{
          borderRight: '1px solid hsl(var(--border))',
          background: 'hsl(var(--secondary)/0.4)',
        }}
      >
        <p className="px-4 pb-3 text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'hsl(var(--muted-foreground))' }}>
          Settings
        </p>
        {SECTIONS.map(({ id, label, icon: Icon }) => {
          const isActive = active === id
          return (
            <button
              key={id}
              onClick={() => setActive(id)}
              className="flex items-center gap-2.5 mx-2 px-3 py-2 rounded-lg text-[13px] font-medium text-left transition-all"
              style={{
                background:  isActive ? 'rgba(120,199,206,0.1)'  : 'transparent',
                color:       isActive ? '#78C7CE'                : 'hsl(var(--muted-foreground))',
                border:      isActive ? '1px solid rgba(120,199,206,0.2)' : '1px solid transparent',
              }}
            >
              <Icon style={{ width: 14, height: 14, flexShrink: 0 }} />
              {label}
            </button>
          )
        })}
      </div>

      {/* ── Content panel ── */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="p-8 max-w-[640px]"
          >
            {renderSection()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

export { SettingsPage }
