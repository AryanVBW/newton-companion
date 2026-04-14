import { motion } from 'framer-motion'
import { CourseOverviewCard } from './course-overview-card'
import { ScheduleTimeline } from './schedule-timeline'
import { QotdCard } from './qotd-card'
import { QuickStats } from './quick-stats'
import { LeaderboardWidget } from './leaderboard-widget'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/empty-state'
import { useNewtonData } from '@/stores/newton-data-store'
import { RefreshCw, WifiOff, Loader2 } from 'lucide-react'
import { useUiStore } from '@/stores/ui-store'
import {
  parseCourseOverview,
  parseLeaderboard,
  parseQotd,
  parseScheduleEvents,
} from '@/lib/newton-parsers'
import { parseToolText } from '@/lib/parse-tool-text'

function DashboardSkeleton() {
  return (
    <div className="p-6 space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[72px] rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Skeleton className="h-44 rounded-xl" />
        <Skeleton className="h-44 rounded-xl" />
      </div>
    </div>
  )
}

function NotConnectedState() {
  const setCurrentPage = useUiStore((s) => s.setCurrentPage)
  return (
    <div className="flex h-full items-center justify-center p-6">
      <EmptyState
        icon={WifiOff}
        title="No Data Yet"
        description="Link your Newton School device in Settings to see your real course data, lectures, assignments and leaderboard."
        actionLabel="Go to Settings"
        onAction={() => setCurrentPage('settings')}
      />
    </div>
  )
}

function DashboardPage() {
  const {
    courseOverview, userProfile, upcomingSchedule, leaderboard,
    qotd, arenaStats, loading, syncing, syncProgress, connected, refresh
  } = useNewtonData()

  if (loading) return <DashboardSkeleton />
  if (!connected && !syncing) return <NotConnectedState />

  const overview = parseCourseOverview(courseOverview)
  const user = parseToolText(userProfile) as { name?: string } | null
  const scheduleEvents = parseScheduleEvents(upcomingSchedule)
  const leaderboardData = parseLeaderboard(leaderboard)
  const qotdData = parseQotd(qotd)
  const arenaData = parseToolText(arenaStats) as {
    solved_questions_count?: number
  } | null
  const userName        = user?.name || 'Student'

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const courseData = overview

  const statsData = {
    lecturesPercent: courseData && courseData.total_lectures > 0
      ? Math.round((courseData.lectures_attended / courseData.total_lectures) * 100)
      : 0,
    assignmentsDone:  courseData?.assignments_completed ?? 0,
    totalAssignments: courseData?.total_assignments     ?? 0,
    problemsSolved:   arenaData?.solved_questions_count ?? 0,
    rank:             courseData?.rank                  ?? 0,
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-full"
    >
      {/* ── Page header ── */}
      <div
        className="px-6 py-4 shrink-0"
        style={{
          background: 'linear-gradient(135deg, hsl(var(--newton-teal) / 0.05) 0%, hsl(var(--newton-blue) / 0.03) 60%, transparent 100%)',
          borderBottom: '1px solid hsl(var(--border))',
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[20px] font-bold tracking-tight">
              {greeting},{' '}
              <span className="gradient-text">{userName}</span>
            </h1>
            <p className="text-[12.5px] mt-0.5" style={{ color: 'hsl(var(--muted-foreground))' }}>
              Here's what's happening in your courses today.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {syncing && (
              <div
                className="flex items-center gap-1.5 text-[11.5px] font-medium px-3 py-1.5 rounded-full"
                style={{
                  background: 'hsl(var(--newton-teal) / 0.08)',
                  color: 'hsl(var(--newton-teal))',
                  border: '1px solid hsl(var(--newton-teal) / 0.18)',
                }}
              >
                <Loader2 className="w-3 h-3 animate-spin" />
                {syncProgress?.tool ? `Syncing ${syncProgress.tool.replace(/_/g, ' ')}…` : 'Syncing…'}
              </div>
            )}
            <button
              onClick={refresh}
              disabled={syncing}
              className="p-2 rounded-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-40"
              style={{
                background: 'hsl(var(--secondary))',
                color: 'hsl(var(--muted-foreground))',
                border: '1px solid hsl(var(--border))',
              }}
              title="Refresh data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-auto p-6 space-y-5">
        <QuickStats data={statsData} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {courseData
            ? <CourseOverviewCard data={courseData} />
            : <Skeleton className="h-72 rounded-xl" />
          }
          <ScheduleTimeline events={scheduleEvents} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <QotdCard data={qotdData} />
          <LeaderboardWidget data={leaderboardData} />
        </div>
      </div>
    </motion.div>
  )
}

export { DashboardPage }
