import { motion } from 'framer-motion'
import { CourseOverviewCard } from './course-overview-card'
import { ScheduleTimeline } from './schedule-timeline'
import { QotdCard } from './qotd-card'
import { QuickStats } from './quick-stats'
import { LeaderboardWidget } from './leaderboard-widget'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/empty-state'
import { useNewtonData } from '@/stores/newton-data-store'
import { RefreshCw, WifiOff, Link2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useUiStore } from '@/stores/ui-store'

// Parse MCP tool response — handles both raw MCP envelope and pre-parsed data
function parseToolText(data: any): any {
  try {
    if (!data) return null
    // If it's already a plain object (from cache), return as-is
    if (typeof data === 'object' && !data?.content?.[0]?.text) return data
    // MCP envelope: { content: [{ text: "..." }] }
    const text = data?.content?.[0]?.text
    if (text) return JSON.parse(text)
    return data
  } catch {
    return data
  }
}

function DashboardSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-[var(--radius)]" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-80 rounded-[var(--radius)]" />
        <Skeleton className="h-80 rounded-[var(--radius)]" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-48 rounded-[var(--radius)]" />
        <Skeleton className="h-48 rounded-[var(--radius)]" />
      </div>
    </div>
  )
}

function NotConnectedState() {
  const setCurrentPage = useUiStore((s) => s.setCurrentPage)
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[hsl(var(--muted))] mb-4">
          <WifiOff className="w-8 h-8 text-[hsl(var(--muted-foreground))]" />
        </div>
        <h2 className="text-xl font-bold mb-2">No Data Yet</h2>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mb-6">
          Link your Newton School device to see your real course data, lectures, assignments, and leaderboard here.
        </p>
        <Button onClick={() => setCurrentPage('settings')} className="gap-2">
          <Link2 className="h-4 w-4" />
          Go to Settings to Link Device
        </Button>
      </div>
    </div>
  )
}

function DashboardPage() {
  const {
    courseOverview, userProfile, upcomingSchedule, leaderboard,
    qotd, arenaStats, loading, syncing, syncProgress, error, connected, refresh
  } = useNewtonData()

  if (loading) return <DashboardSkeleton />

  if (!connected && !syncing) return <NotConnectedState />

  const overview = parseToolText(courseOverview)
  const user = parseToolText(userProfile)
  const scheduleData = parseToolText(upcomingSchedule)
  const leaderboardData = parseToolText(leaderboard)
  const qotdData = parseToolText(qotd)
  const arenaData = parseToolText(arenaStats)
  const userName = user?.name || 'Student'

  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const courseData = overview
    ? {
        course_name: overview.course_name || '',
        semester_name: overview.semester_name || '',
        total_xp: overview.total_xp ?? overview.total_earned_points ?? 0,
        current_level: overview.current_level ?? 0,
        rank: overview.rank ?? 0,
        total_students: overview.total_students ?? 0,
        lectures_attended: overview.lectures_attended ?? overview.total_lectures_attended ?? 0,
        total_lectures: overview.total_lectures ?? 0,
        assignments_completed: overview.assignments_completed ?? overview.total_completed_assignment_questions ?? 0,
        total_assignments: overview.total_assignments ?? 0,
        subjects: overview.subjects ?? [],
      }
    : null

  // Build stats from real data
  const statsData = {
    lecturesPercent: courseData && courseData.total_lectures > 0
      ? Math.round((courseData.lectures_attended / courseData.total_lectures) * 100)
      : 0,
    assignmentsDone: courseData?.assignments_completed ?? 0,
    totalAssignments: courseData?.total_assignments ?? 0,
    problemsSolved: arenaData?.solved_questions_count ?? 0,
    rank: courseData?.rank ?? 0,
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6 space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {greeting}, {userName}
          </h1>
          <p className="text-[hsl(var(--muted-foreground))] text-sm mt-1">
            Here's what's happening today in your courses.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {syncing && (
            <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))] px-2.5 py-1 rounded-full">
              <Loader2 className="w-3 h-3 animate-spin" />
              {syncProgress?.tool ? `Syncing ${syncProgress.tool}...` : 'Syncing...'}
            </div>
          )}
          <button
            onClick={refresh}
            disabled={syncing}
            className="p-2 rounded-lg hover:bg-[hsl(var(--muted))] transition-colors text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] disabled:opacity-50"
            title="Refresh data"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <QuickStats data={statsData} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {courseData && <CourseOverviewCard data={courseData} />}
        <ScheduleTimeline events={scheduleData?.events} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <QotdCard data={qotdData} />
        <LeaderboardWidget data={leaderboardData} />
      </div>
    </motion.div>
  )
}

export { DashboardPage }
