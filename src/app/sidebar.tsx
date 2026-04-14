import {
  LayoutDashboard,
  BookOpen,
  ClipboardList,
  Swords,
  MessageSquare,
  Plug,
  Server,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { useUiStore, type Page } from '@/stores/ui-store'
import { Avatar } from '@/components/ui/avatar'
import { StatusDot } from '@/components/status-dot'
import { useNewtonAuthStore } from '@/stores/newton-auth-store'
import { LogoIcon } from '@/components/newton-logo'

const NAV_ITEMS: { page: Page; label: string; icon: React.ElementType }[] = [
  { page: 'dashboard',   label: 'Dashboard',   icon: LayoutDashboard },
  { page: 'lectures',    label: 'Lectures',     icon: BookOpen },
  { page: 'assignments', label: 'Assignments',  icon: ClipboardList },
  { page: 'arena',       label: 'Arena',        icon: Swords },
  { page: 'chat',         label: 'AI Chat',       icon: MessageSquare },
  { page: 'integrations', label: 'Integrations',  icon: Plug },
  { page: 'mcp-servers',  label: 'MCP Servers',   icon: Server },
  { page: 'settings',    label: 'Settings',     icon: Settings },
]

interface SidebarProps {
  mcpConnected: number
}

function Sidebar({ mcpConnected }: SidebarProps) {
  const currentPage = useUiStore((s) => s.currentPage)
  const setCurrentPage = useUiStore((s) => s.setCurrentPage)
  const userName  = useNewtonAuthStore((s) => s.userName)  || 'Student'
  const userEmail = useNewtonAuthStore((s) => s.userEmail) || ''
  const initials  = userName
    .split(' ')
    .slice(0, 2)
    .map((n: string) => n[0])
    .join('')
    .toUpperCase() || 'S'

  return (
    <div className="newton-sidebar flex h-full w-[220px] shrink-0 flex-col">

      {/* ── Traffic-light region (macOS overlay titlebar) ─────── */}
      <div
        data-tauri-drag-region
        className="shrink-0 flex items-end px-4 pb-3.5"
        style={{ height: 68 }}
      >
        {/* 72px spacer for the three traffic light buttons */}
        <div className="w-[72px]" data-tauri-drag-region />

        {/* Logo icon only — wordmark replaced by app name label */}
        <div className="flex items-center gap-2" data-tauri-drag-region>
          <LogoIcon size={22} />
          {/* App wordmark via CSS-filtered SVG — adapts to theme */}
          <img
            src="/logo.svg"
            alt="Newton School"
            className="sidebar-wordmark"
            style={{ height: 14, width: 'auto' }}
          />
        </div>
      </div>

      {/* Separator */}
      <div className="sidebar-sep mb-1.5" />

      {/* ── Navigation ──────────────────────────────────────── */}
      <nav className="flex-1 px-2.5 py-1 space-y-0.5 overflow-auto">
        {NAV_ITEMS.map(({ page, label, icon: Icon }) => {
          const isActive = currentPage === page
          return (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={cn('newton-nav-item', isActive && 'active')}
            >
              {isActive && <span className="nav-pill" />}
              <Icon
                style={{
                  width: 15,
                  height: 15,
                  flexShrink: 0,
                  opacity: isActive ? 1 : 0.75,
                }}
              />
              <span className="truncate flex-1">{label}</span>
              {page === 'mcp-servers' && (
                <StatusDot
                  status={mcpConnected > 0 ? 'connected' : 'disconnected'}
                  className="ml-auto"
                />
              )}
            </button>
          )
        })}
      </nav>

      {/* Separator */}
      <div className="sidebar-sep mt-2 mb-0" />

      {/* ── User footer ─────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-3.5 py-3.5">
        <Avatar fallback={initials} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-[12.5px] font-semibold leading-tight truncate sidebar-user-name">
            {userName}
          </p>
          {userEmail ? (
            <p className="text-[11px] mt-0.5 truncate sidebar-user-sub">{userEmail}</p>
          ) : (
            <p className="text-[11px] mt-0.5 sidebar-user-sub">Newton School</p>
          )}
        </div>
      </div>
    </div>
  )
}

export { Sidebar }
