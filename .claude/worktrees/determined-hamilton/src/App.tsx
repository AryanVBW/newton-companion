import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTheme } from '@/hooks/use-theme'
import { useMcp } from '@/hooks/use-mcp'
import { useNewtonAuthStore } from '@/stores/newton-auth-store'
import { useNewtonDataStore } from '@/stores/newton-data-store'
import { useUiStore } from '@/stores/ui-store'
import { AppLayout } from '@/app/layout'
import { OnboardingPage } from '@/pages/onboarding'
import { DashboardPage } from '@/pages/dashboard'
import { LecturesPage } from '@/pages/lectures'
import { AssignmentsPage } from '@/pages/assignments'
import { ArenaPage } from '@/pages/arena'
import { ChatPage } from '@/pages/chat'
import { McpServersPage } from '@/pages/mcp-servers'
import { SettingsPage } from '@/pages/settings'
import { Loader2 } from 'lucide-react'

const pageTransition = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.15 },
}

function PageContent() {
  const currentPage = useUiStore((s) => s.currentPage)

  return (
    <AnimatePresence mode="wait">
      <motion.div key={currentPage} className="h-full" {...pageTransition}>
        {currentPage === 'dashboard' && <DashboardPage />}
        {currentPage === 'lectures' && <LecturesPage />}
        {currentPage === 'assignments' && <AssignmentsPage />}
        {currentPage === 'arena' && <ArenaPage />}
        {currentPage === 'chat' && <ChatPage />}
        {currentPage === 'mcp-servers' && <McpServersPage />}
        {currentPage === 'settings' && <SettingsPage />}
      </motion.div>
    </AnimatePresence>
  )
}

function App() {
  useTheme()
  const { connectedCount } = useMcp()
  const loading = useNewtonAuthStore((s) => s.loading)
  const authenticated = useNewtonAuthStore((s) => s.authenticated)
  const boot = useNewtonAuthStore((s) => s.boot)
  const onboardingComplete = useUiStore((s) => s.onboardingComplete)
  const completeOnboarding = useUiStore((s) => s.completeOnboarding)

  const initData = useNewtonDataStore((s) => s.init)

  // Boot once on startup — checks persisted session, auto-connects if needed
  useEffect(() => {
    boot()
  }, [boot])

  // After auth boot, init data (loads cache + background sync)
  useEffect(() => {
    if (!loading && authenticated) {
      initData()
    }
  }, [loading, authenticated, initData])

  // Show loading while checking auth state
  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[hsl(var(--background))]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--primary))]" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {authenticated ? 'Connecting to Newton School...' : 'Loading...'}
          </p>
        </div>
      </div>
    )
  }

  if (!onboardingComplete) {
    return <OnboardingPage onComplete={completeOnboarding} />
  }

  return (
    <AppLayout mcpConnected={connectedCount}>
      <PageContent />
    </AppLayout>
  )
}

export default App
