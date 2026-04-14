import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Calendar,
  FileText,
  StickyNote,
  Link2,
  Unlink2,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  type IntegrationStatus,
  disconnectGoogleAuth,
  getIntegrationStatus,
  removeIntegration,
  saveIntegration,
  startGoogleAuth,
} from '@/lib/api/integrations'

function IntegrationsPage() {
  const [status, setStatus] = useState<IntegrationStatus | null>(null)
  const [loading, setLoading] = useState(true)

  // Notion state
  const [notionKey, setNotionKey] = useState('')
  const [notionSaving, setNotionSaving] = useState(false)

  // Google Calendar state
  const [gcalClientId, setGcalClientId] = useState('')
  const [gcalClientSecret, setGcalClientSecret] = useState('')
  const [gcalSaving, setGcalSaving] = useState(false)

  const refreshStatus = useCallback(async () => {
    try {
      const result = await getIntegrationStatus()
      setStatus(result)
    } catch (e) {
      console.error('Failed to get integration status:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshStatus()
  }, [refreshStatus])

  const saveNotion = async () => {
    if (!notionKey.trim()) return
    setNotionSaving(true)
    try {
      await saveIntegration({
        id: 'notion-default',
        provider: 'notion',
        apiKey: notionKey.trim(),
        config: null,
      })
      setNotionKey('')
      await refreshStatus()
    } catch (e) {
      console.error('Failed to save Notion integration:', e)
    } finally {
      setNotionSaving(false)
    }
  }

  const disconnectNotion = async () => {
    try {
      await removeIntegration({
        id: 'notion-default',
        provider: 'notion',
      })
      await refreshStatus()
    } catch (e) {
      console.error('Failed to disconnect Notion:', e)
    }
  }

  const connectGoogleCalendar = async () => {
    if (!gcalClientId.trim() || !gcalClientSecret.trim()) return
    setGcalSaving(true)
    try {
      const authUrl = await startGoogleAuth({
        clientId: gcalClientId.trim(),
        clientSecret: gcalClientSecret.trim(),
      })
      window.open(authUrl, '_blank')
    } catch (e) {
      console.error('Failed to start Google auth:', e)
    } finally {
      setGcalSaving(false)
    }
  }

  const disconnectGoogleCalendar = async () => {
    try {
      await disconnectGoogleAuth()
      await refreshStatus()
    } catch (e) {
      console.error('Failed to disconnect Google Calendar:', e)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full"
    >
      <ScrollArea className="h-full">
        <div className="p-6 max-w-2xl">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Integrations</h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
              Connect your tools so the AI brain can schedule, take notes, and
              orchestrate your workflow.
            </p>
          </div>

          {/* Status Summary */}
          <div className="flex gap-3 mb-6 flex-wrap">
            <StatusBadge
              label="Google Calendar"
              connected={status?.google_calendar.connected ?? false}
            />
            <StatusBadge
              label="Notion"
              connected={status?.notion.connected ?? false}
            />
          </div>

          <div className="space-y-4">
            {/* Google Calendar */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                      <Calendar className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <CardTitle className="text-base">
                        Google Calendar
                      </CardTitle>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                        Schedule events, check availability, manage deadlines
                      </p>
                    </div>
                  </div>
                  {status?.google_calendar.connected && (
                    <Badge variant="secondary" className="gap-1">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      Connected
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {status?.google_calendar.connected ? (
                  <div className="space-y-3">
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                      The AI brain can now create, list, and delete calendar
                      events. Try asking: "Schedule a study session for
                      tomorrow at 3pm"
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={refreshStatus}
                        className="gap-1.5"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Refresh
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={disconnectGoogleCalendar}
                        className="text-red-500 hover:text-red-600 gap-1.5"
                      >
                        <Unlink2 className="h-3 w-3" />
                        Disconnect
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      Create a Google Cloud OAuth 2.0 client ID at{' '}
                      <button
                        onClick={() =>
                          window.open('https://console.cloud.google.com/apis/credentials', '_blank')
                        }
                        className="text-[hsl(var(--primary))] underline"
                      >
                        console.cloud.google.com
                      </button>
                      . Add{' '}
                      <code className="text-[10px] bg-[hsl(var(--muted))] px-1 py-0.5 rounded">
                        http://localhost:17248/callback
                      </code>{' '}
                      as a redirect URI.
                    </p>
                    <div className="grid gap-2">
                      <Input
                        value={gcalClientId}
                        onChange={(e) => setGcalClientId(e.target.value)}
                        placeholder="Client ID"
                        className="text-sm"
                      />
                      <Input
                        value={gcalClientSecret}
                        onChange={(e) => setGcalClientSecret(e.target.value)}
                        placeholder="Client Secret"
                        type="password"
                        className="text-sm"
                      />
                    </div>
                    <Button
                      onClick={connectGoogleCalendar}
                      disabled={
                        !gcalClientId.trim() ||
                        !gcalClientSecret.trim() ||
                        gcalSaving
                      }
                      size="sm"
                      className="gap-1.5"
                    >
                      {gcalSaving ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Link2 className="h-3 w-3" />
                      )}
                      Connect Google Calendar
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notion */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(var(--foreground))]/5">
                      <StickyNote className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Notion</CardTitle>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                        Search, create, and update pages and databases
                      </p>
                    </div>
                  </div>
                  {status?.notion.connected && (
                    <Badge variant="secondary" className="gap-1">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      Connected
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {status?.notion.connected ? (
                  <div className="space-y-3">
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                      Notion is connected via MCP. The AI brain can search,
                      read, and create Notion pages. Try: "Create a study
                      plan in Notion for my upcoming exam"
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={disconnectNotion}
                      className="text-red-500 hover:text-red-600 gap-1.5"
                    >
                      <Unlink2 className="h-3 w-3" />
                      Disconnect
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      Create an internal integration at{' '}
                      <button
                        onClick={() =>
                          window.open('https://www.notion.so/my-integrations', '_blank')
                        }
                        className="text-[hsl(var(--primary))] underline"
                      >
                        notion.so/my-integrations
                      </button>
                      , then paste the Internal Integration Secret below.
                    </p>
                    <div className="flex gap-2">
                      <Input
                        value={notionKey}
                        onChange={(e) => setNotionKey(e.target.value)}
                        placeholder="ntn_xxxxxxxxxxxxxxxxxxxx"
                        type="password"
                        className="text-sm flex-1"
                      />
                      <Button
                        onClick={saveNotion}
                        disabled={!notionKey.trim() || notionSaving}
                        size="sm"
                        className="gap-1.5 shrink-0"
                      >
                        {notionSaving ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Link2 className="h-3 w-3" />
                        )}
                        Connect
                      </Button>
                    </div>
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                      Requires <code>npx</code> / Node.js installed. The Notion MCP
                      server runs locally.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* AI Brain Capabilities */}
            <Separator />
            <div>
              <h2 className="text-sm font-semibold mb-3">
                What the AI Brain can do with integrations
              </h2>
              <div className="grid gap-2">
                <CapabilityRow
                  icon={Calendar}
                  title="Smart Scheduling"
                  description='Say "schedule exam prep for this week" — it checks your calendar for free slots and creates events.'
                  available={status?.google_calendar.connected ?? false}
                />
                <CapabilityRow
                  icon={StickyNote}
                  title="Note Creation"
                  description='Say "create a study guide in Notion for Chapter 5" — it creates a structured page.'
                  available={status?.notion.connected ?? false}
                />
                <CapabilityRow
                  icon={Link2}
                  title="Cross-Linking"
                  description="When both are connected, the brain links calendar events to Notion pages automatically."
                  available={
                    (status?.google_calendar.connected ?? false) &&
                    (status?.notion.connected ?? false)
                  }
                />
                <CapabilityRow
                  icon={FileText}
                  title="Deadline Tracking"
                  description="The brain reads your assignments and proactively suggests scheduling study time."
                  available={status?.google_calendar.connected ?? false}
                />
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </motion.div>
  )
}

function StatusBadge({
  label,
  connected,
}: {
  label: string
  connected: boolean
}) {
  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
        connected
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]'
      }`}
    >
      {connected ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : (
        <XCircle className="h-3 w-3 opacity-50" />
      )}
      {label}
    </div>
  )
}

function CapabilityRow({
  icon: Icon,
  title,
  description,
  available,
}: {
  icon: React.ElementType
  title: string
  description: string
  available: boolean
}) {
  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg border ${
        available
          ? 'border-[hsl(var(--border))] bg-[hsl(var(--card))]'
          : 'border-dashed border-[hsl(var(--border))]/50 opacity-50'
      }`}
    >
      <Icon className="h-4 w-4 mt-0.5 shrink-0" />
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
          {description}
        </p>
      </div>
      {available && (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5 ml-auto" />
      )}
    </div>
  )
}

export { IntegrationsPage }
