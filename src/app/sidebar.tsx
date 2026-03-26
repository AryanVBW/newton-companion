import {
  LayoutDashboard,
  BookOpen,
  ClipboardList,
  Swords,
  MessageSquare,
  Server,
  Settings,
  GraduationCap,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { useUiStore, type Page } from '@/stores/ui-store'
import { Avatar } from '@/components/ui/avatar'
import { StatusDot } from '@/components/status-dot'
import { Separator } from '@/components/ui/separator'

const NAV_ITEMS: { page: Page; label: string; icon: React.ElementType }[] = [
  { page: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { page: 'lectures', label: 'Lectures', icon: BookOpen },
  { page: 'assignments', label: 'Assignments', icon: ClipboardList },
  { page: 'arena', label: 'Arena', icon: Swords },
  { page: 'chat', label: 'AI Chat', icon: MessageSquare },
  { page: 'mcp-servers', label: 'MCP Servers', icon: Server },
  { page: 'settings', label: 'Settings', icon: Settings },
]

interface SidebarProps {
  mcpConnected: number
}

function Sidebar({ mcpConnected }: SidebarProps) {
  const currentPage = useUiStore((s) => s.currentPage)
  const setCurrentPage = useUiStore((s) => s.setCurrentPage)

  return (
    <div className="flex h-full w-[240px] shrink-0 flex-col bg-[hsl(240_10%_6%)] text-white border-r border-white/5">
      {/* Drag region for macOS traffic lights */}
      <div data-tauri-drag-region className="h-[52px] flex items-center px-5 shrink-0">
        <div className="w-[58px]" data-tauri-drag-region />
      </div>

      {/* Logo */}
      <div className="flex items-center gap-3 px-5 pb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(var(--primary))]">
          <GraduationCap className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-semibold leading-tight">Newton</h1>
          <p className="text-[11px] text-white/50">Companion</p>
        </div>
      </div>

      <Separator className="bg-white/5 mx-4" />

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-auto">
        {NAV_ITEMS.map(({ page, label, icon: Icon }) => {
          const isActive = currentPage === page
          return (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer',
                'hover:bg-white/5',
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-white/60'
              )}
            >
              {isActive && (
                <div className="absolute left-0 w-[3px] h-6 rounded-r-full bg-[hsl(var(--primary))]" />
              )}
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span className="truncate">{label}</span>
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

      <Separator className="bg-white/5 mx-4" />

      {/* User section */}
      <div className="flex items-center gap-3 px-5 py-4">
        <Avatar fallback="VS" size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-tight truncate">Vivek S.</p>
          <p className="text-[11px] text-white/40 truncate">NST '25</p>
        </div>
      </div>
    </div>
  )
}

export { Sidebar }
