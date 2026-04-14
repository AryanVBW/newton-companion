import { type ReactNode } from 'react'
import { Sidebar } from './sidebar'
import { useUiStore } from '@/stores/ui-store'
import { useNewtonDataStore } from '@/stores/newton-data-store'
import { Loader2, Minus, Square, X } from 'lucide-react'
import { getCurrentWindow } from '@tauri-apps/api/window'

interface AppLayoutProps {
  children: ReactNode
  mcpConnected: number
}

const PAGE_TITLES: Record<string, string> = {
  dashboard:     'Dashboard',
  lectures:      'Lectures',
  assignments:   'Assignments',
  arena:         'Arena',
  chat:          'AI Chat',
  integrations:  'Integrations',
  'mcp-servers': 'MCP Servers',
  settings:      'Settings',
}

function AppLayout({ children, mcpConnected }: AppLayoutProps) {
  const currentPage   = useUiStore((s) => s.currentPage)
  const syncing       = useNewtonDataStore((s) => s.syncing)
  const syncProgress  = useNewtonDataStore((s) => s.syncProgress)
  const lastSyncedAt  = useNewtonDataStore((s) => s.lastSyncedAt)
  const title         = PAGE_TITLES[currentPage] ?? 'Newton Companion'

  const syncLabel = (() => {
    if (!syncProgress) return 'Syncing…'
    const toolName = syncProgress.tool?.replace(/_/g, ' ') ?? 'data'
    if (syncProgress.total > 0) {
      return `${toolName} (${syncProgress.done}/${syncProgress.total})`
    }
    return toolName
  })()

  const lastSyncLabel = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : null

  return (
    <div
      className="flex h-screen w-screen overflow-hidden"
      style={{ background: 'hsl(var(--background))' }}
    >
      <Sidebar mcpConnected={mcpConnected} />

      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* ── macOS-style titlebar ── */}
        <div
          data-tauri-drag-region
          className="titlebar select-none"
        >
          {/* Page title */}
          <h2
            data-tauri-drag-region
            className="text-[13px] font-semibold tracking-tight"
            style={{ color: 'hsl(var(--foreground))' }}
          >
            {title}
          </h2>

          {/* Right: sync indicator + window controls */}
          <div data-tauri-drag-region className="flex items-center gap-2">
            {syncing ? (
              <div
                className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full"
                style={{
                  background: 'hsl(var(--newton-teal) / 0.08)',
                  color: 'hsl(var(--newton-teal))',
                  border: '1px solid hsl(var(--newton-teal) / 0.16)',
                }}
              >
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                {syncLabel}
              </div>
            ) : lastSyncLabel ? (
              <span
                className="text-[11px]"
                style={{ color: 'hsl(var(--muted-foreground))' }}
              >
                Updated {lastSyncLabel}
              </span>
            ) : null}

            {/* Window controls */}
            <div className="flex items-center ml-2">
              <button
                onClick={() => getCurrentWindow().minimize()}
                className="window-control-btn"
                title="Minimize"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => getCurrentWindow().toggleMaximize()}
                className="window-control-btn"
                title="Maximize"
              >
                <Square className="w-3 h-3" />
              </button>
              <button
                onClick={() => getCurrentWindow().close()}
                className="window-control-btn window-control-close"
                title="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Page content ── */}
        <main
          className="flex-1 overflow-hidden"
          style={{ background: 'hsl(var(--background))' }}
        >
          {children}
        </main>
      </div>
    </div>
  )
}

export { AppLayout }
