import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Search, RefreshCw, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FilterPanel } from './filter-panel'
import { ProblemCard } from './problem-card'
import { AiSuggestions } from './ai-suggestions'
import { useNewtonData } from '@/stores/newton-data-store'
import { useArenaSearch } from '@/hooks/use-arena-search'
import {
  parseArenaDifficultyOptions,
  parseArenaTopicOptions,
} from '@/lib/newton-parsers'
import { parseToolText } from '@/lib/parse-tool-text'

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
  const { arenaStats, arenaFilters, loading: storeLoading, refresh } = useNewtonData()
  const [search, setSearch] = useState('')
  const [difficulty, setDifficulty] = useState<string | null>(null)
  const [topic, setTopic] = useState<string | null>(null)
  const [showSolved, setShowSolved] = useState(true)

  const stats = useMemo(() => {
    const parsed = parseToolText(arenaStats)
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as { solved_questions_count?: number })
      : null
  }, [arenaStats])
  const filters = useMemo(() => arenaFilters, [arenaFilters])

  // Extract topic/difficulty options from arenaFilters
  const topicOptions = useMemo(() => parseArenaTopicOptions(filters), [filters])

  const difficultyOptions = useMemo(
    () => parseArenaDifficultyOptions(filters),
    [filters]
  )

  // Live search via MCP
  const { problems, loading: searchLoading, hasMore } = useArenaSearch({
    query: search || undefined,
    difficulty,
    topic,
  })

  const totalSolved =
    stats?.solved_questions_count ?? problems.filter((p) => p.solved).length

  // Client-side filter for show/hide solved
  const filtered = useMemo(() => {
    if (showSolved) return problems
    return problems.filter((p) => !p.solved)
  }, [problems, showSolved])

  if (storeLoading) return <ArenaSkeleton />

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
              <h1 className="text-2xl font-bold">Arena</h1>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                Practice problems to sharpen your skills. {totalSolved} solved total.
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

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
            <div>
              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                <Input
                  placeholder="Search problems..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
                {searchLoading && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-[hsl(var(--muted-foreground))]" />
                )}
              </div>

              {/* Filters */}
              <div className="mb-4">
                <FilterPanel
                  selectedDifficulty={difficulty}
                  onDifficultyChange={setDifficulty}
                  difficulties={difficultyOptions}
                  selectedCategory={topic}
                  onCategoryChange={setTopic}
                  categories={topicOptions.map((topicOption) => topicOption.label)}
                  categorySlugs={topicOptions.map((topicOption) => topicOption.slug)}
                  showSolved={showSolved}
                  onShowSolvedChange={setShowSolved}
                />
              </div>

              {/* Problem list */}
              <div className="space-y-2">
                {filtered.map((problem) => (
                  <ProblemCard key={problem.id} problem={problem} />
                ))}
                {!searchLoading && filtered.length === 0 && (
                  <div className="text-center py-12 text-sm text-[hsl(var(--muted-foreground))]">
                    No problems match your filters.
                  </div>
                )}
                {hasMore && !searchLoading && (
                  <div className="text-center py-4 text-xs text-[hsl(var(--muted-foreground))]">
                    Showing first {filtered.length} results. Refine your search to find more.
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div>
              <AiSuggestions />
            </div>
          </div>
        </div>
      </ScrollArea>
    </motion.div>
  )
}

export { ArenaPage }
