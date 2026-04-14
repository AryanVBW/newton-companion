import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CalendarDays, List, RefreshCw } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CalendarView } from './calendar-view'
import { ListView } from './list-view'
import { LectureDetailPanel } from './lecture-detail-panel'
import { useNewtonData } from '@/stores/newton-data-store'
import type { Lecture } from '@/types/newton'


function LecturesSkeleton() {
  return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-10 w-60 rounded-[var(--radius)]" />
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 35 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-[var(--radius)]" />
        ))}
      </div>
    </div>
  )
}

function LecturesPage() {
  const { recentLectures, loading, refresh } = useNewtonData()
  const [selectedLecture, setSelectedLecture] = useState<Lecture | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  const lectures = useMemo(
    () => (Array.isArray(recentLectures) ? recentLectures : []),
    [recentLectures]
  )

  if (loading) return <LecturesSkeleton />

  const attended = lectures.filter((l) => l.status === 'attended').length
  const missed = lectures.filter((l) => l.status === 'missed').length

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex h-full"
    >
      <div className="flex-1 min-w-0">
        <ScrollArea className="h-full">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold">Lectures</h1>
                <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                  {attended} attended, {missed} missed out of {lectures.length} lectures.
                </p>
              </div>
              <button
                onClick={refresh}
                className="p-2 rounded-lg hover:bg-[hsl(var(--muted))] transition-colors text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <Tabs defaultValue="list">
              <TabsList className="mb-4">
                <TabsTrigger value="calendar" className="gap-2">
                  <CalendarDays className="h-4 w-4" />
                  Calendar
                </TabsTrigger>
                <TabsTrigger value="list" className="gap-2">
                  <List className="h-4 w-4" />
                  List
                </TabsTrigger>
              </TabsList>

              <TabsContent value="calendar">
                <Card>
                  <CardContent className="p-4">
                    <CalendarView
                      lectures={lectures}
                      onSelectDate={setSelectedDate}
                      selectedDate={selectedDate}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="list">
                <ListView
                  lectures={lectures}
                  onSelectLecture={setSelectedLecture}
                  selectedLecture={selectedLecture}
                />
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </div>

      <AnimatePresence>
        {selectedLecture && (
          <LectureDetailPanel
            key={selectedLecture.id}
            lecture={selectedLecture}
            onClose={() => setSelectedLecture(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export { LecturesPage }
