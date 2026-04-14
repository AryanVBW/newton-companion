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
import { IntegrationsPage } from '@/pages/integrations'
import { McpServersPage } from '@/pages/mcp-servers'
import { SettingsPage } from '@/pages/settings'

const pageTransition = {
  initial:    { opacity: 0, y: 6 },
  animate:    { opacity: 1, y: 0 },
  exit:       { opacity: 0, y: -6 },
  transition: { duration: 0.16 },
} as const

function PageContent() {
  const currentPage = useUiStore((s) => s.currentPage)

  return (
    <AnimatePresence mode="wait">
      <motion.div key={currentPage} className="h-full" {...pageTransition}>
        {currentPage === 'dashboard'   && <DashboardPage />}
        {currentPage === 'lectures'    && <LecturesPage />}
        {currentPage === 'assignments' && <AssignmentsPage />}
        {currentPage === 'arena'       && <ArenaPage />}
        {currentPage === 'chat'         && <ChatPage />}
        {currentPage === 'integrations' && <IntegrationsPage />}
        {currentPage === 'mcp-servers'  && <McpServersPage />}
        {currentPage === 'settings'    && <SettingsPage />}
      </motion.div>
    </AnimatePresence>
  )
}

function SplashScreen({ authenticated }: { authenticated: boolean }) {
  return (
    <div className="flex h-screen w-screen items-center justify-center onboarding-bg">
      <motion.div
        className="flex flex-col items-center gap-4"
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        {/* Logo icon with glow halo */}
        <div className="relative">
          <div
            className="absolute inset-0 blur-3xl opacity-50 rounded-full"
            style={{ background: 'radial-gradient(circle, hsl(var(--newton-teal)) 0%, transparent 70%)' }}
          />
          <img
            src="/logo.png"
            alt="Newton"
            className="animate-float relative"
            style={{ width: 60, height: 60 }}
          />
        </div>

        {/* Wordmark — adapts via CSS class */}
        <img
          src="/logo.svg"
          alt="Newton School"
          className="sidebar-wordmark"
          style={{ height: 17, width: 'auto' }}
        />

        {/* Animated dots */}
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: 'hsl(var(--newton-teal))' }}
              animate={{ opacity: [0.25, 1, 0.25] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </div>

        <p
          className="text-[12px] font-medium"
          style={{ color: 'hsl(var(--muted-foreground))' }}
        >
          {authenticated ? 'Connecting to Newton School…' : 'Loading…'}
        </p>
      </motion.div>
    </div>
  )
}

function App() {
  useTheme()
  const { connectedCount } = useMcp()
  const loading            = useNewtonAuthStore((s) => s.loading)
  const authenticated      = useNewtonAuthStore((s) => s.authenticated)
  const boot               = useNewtonAuthStore((s) => s.boot)
  const onboardingComplete = useUiStore((s) => s.onboardingComplete)
  const completeOnboarding = useUiStore((s) => s.completeOnboarding)
  const initData           = useNewtonDataStore((s) => s.init)
  const resetData          = useNewtonDataStore((s) => s.reset)

  useEffect(() => {
    void boot()
  }, [boot])

  useEffect(() => {
    if (loading) return

    if (authenticated) {
      void initData()
      return
    }

    resetData()
  }, [loading, authenticated, initData, resetData])

  if (loading) return <SplashScreen authenticated={authenticated} />

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
