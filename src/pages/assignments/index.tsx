import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { EmptyState } from '@/components/empty-state'
import { AssignmentCard } from './assignment-card'
import { ClipboardList, RefreshCw } from 'lucide-react'
import { useNewtonData } from '@/stores/newton-data-store'
import { parseAssignments } from '@/lib/newton-parsers'

function AssignmentsSkeleton() {
  return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-10 w-64" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-[var(--radius)]" />
        ))}
      </div>
    </div>
  )
}

function AssignmentsPage() {
  const { assignments: rawAssignments, loading, refresh } = useNewtonData()

  const allAssignments = useMemo(() => {
    return parseAssignments(rawAssignments)
  }, [rawAssignments])

  if (loading) return <AssignmentsSkeleton />

  const pending = allAssignments.filter((a) => a.status === 'pending' || a.status === 'overdue')
  const submitted = allAssignments.filter((a) => a.status === 'submitted')
  const graded = allAssignments.filter((a) => a.status === 'graded')

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full"
    >
      <ScrollArea className="h-full">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">Assignments</h1>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                Track your assignments, deadlines, and grades.
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

          <Tabs defaultValue="pending">
            <TabsList className="mb-4">
              <TabsTrigger value="pending">
                Pending ({pending.length})
              </TabsTrigger>
              <TabsTrigger value="submitted">
                Submitted ({submitted.length})
              </TabsTrigger>
              <TabsTrigger value="graded">
                Graded ({graded.length})
              </TabsTrigger>
              <TabsTrigger value="all">
                All ({allAssignments.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending">
              {pending.length === 0 ? (
                <EmptyState
                  icon={ClipboardList}
                  title="All caught up!"
                  description="You have no pending assignments. Great work!"
                />
              ) : (
                <div className="space-y-3">
                  {pending.map((a) => <AssignmentCard key={a.id} assignment={a} />)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="submitted">
              {submitted.length === 0 ? (
                <EmptyState
                  icon={ClipboardList}
                  title="Nothing submitted recently"
                  description="Submitted assignments will appear here."
                />
              ) : (
                <div className="space-y-3">
                  {submitted.map((a) => <AssignmentCard key={a.id} assignment={a} />)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="graded">
              {graded.length === 0 ? (
                <EmptyState
                  icon={ClipboardList}
                  title="No grades yet"
                  description="Graded assignments will appear here."
                />
              ) : (
                <div className="space-y-3">
                  {graded.map((a) => <AssignmentCard key={a.id} assignment={a} />)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="all">
              <div className="space-y-3">
                {allAssignments.map((a) => <AssignmentCard key={a.id} assignment={a} />)}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </motion.div>
  )
}

export { AssignmentsPage }
