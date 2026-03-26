import { type ReactNode } from 'react'
import { Sidebar } from './sidebar'
import { Titlebar } from './titlebar'

interface AppLayoutProps {
  children: ReactNode
  mcpConnected: number
}

function AppLayout({ children, mcpConnected }: AppLayoutProps) {
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar mcpConnected={mcpConnected} />
      <div className="flex flex-1 flex-col min-w-0">
        <Titlebar />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}

export { AppLayout }
