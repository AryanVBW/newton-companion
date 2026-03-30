import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Search, RefreshCw } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FilterPanel } from './filter-panel'
import { ProblemCard } from './problem-card'
import { useNewtonData } from '@/stores/newton-data-store'
import { useArenaSearch } from '@/hooks/use-arena-search'
import type { Difficulty } from '@/types/newton'

function ArenaSkeleton() {
  return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-10 w-full max-w-md" />
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-[var(--radius)]" />
        ))}
      </div>
    </div>
  )
}

function ArenaPage() {
  const { arenaStats, loading: dataLoading, refresh } = useNewtonData()
  const [search, setSearch] = useState('')
  const [difficulty, setDifficulty] = useState<string | null>(null)
  const [category, setCategory] = useState<string | null>(null)
  const [showSolved, setShowSolved] = useState(true)

  const { problems, loading: searchLoading } = useArenaSearch({
    query: search || undefined,
    difficulty: difficulty ?? undefined,
    topics: category ?? undefined,
  })

  const stats = arenaStats as any
  const totalSolved = stats?.solved_questions_count ?? 0

  const categories = useMemo(
    () => Array.from(new Set(problems.map((p) => p.category).filter(Boolean))),
    [problems]
  )

  // Server handles query/difficulty/topics filtering; client-side only for showSolved
  const filtered = useMemo(
    () => (showSolved ? problems : problems.filter((p) => !p.solved)),
    [problems, showSolved]
  )

  if (dataLoading) return <ArenaSkeleton />

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <ScrollArea className="h-full">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">Arena</h1>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                Practice problems to sharpen your skills.{totalSolved > 0 ? ` ${totalSolved} solved total.` : ''}
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

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <Input
              placeholder="Search problems..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filters */}
          <div className="mb-4">
            <FilterPanel
              selectedDifficulty={difficulty}
              onDifficultyChange={setDifficulty}
              selectedCategory={category}
              onCategoryChange={setCategory}
              categories={categories}
              showSolved={showSolved}
              onShowSolvedChange={setShowSolved}
            />
          </div>

          {/* Problem list */}
          {searchLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-[var(--radius)]" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-sm text-[hsl(var(--muted-foreground))]">
              No problems match your filters.
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((problem) => (
                <ProblemCard key={problem.id} problem={problem} />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </motion.div>
  )
}

export { ArenaPage }
