import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Search, RefreshCw } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FilterPanel } from './filter-panel'
import { ProblemCard } from './problem-card'
import { AiSuggestions } from './ai-suggestions'
import { useNewtonData } from '@/stores/newton-data-store'
import type { ArenaProblem, Difficulty } from '@/types/newton'

function parseToolText(data: any): any {
  try {
    if (!data) return null
    const text = data?.content?.[0]?.text
    if (text) return JSON.parse(text)
    return data
  } catch { return data }
}

// Fallback problems shown when no real data available
const FALLBACK_PROBLEMS: ArenaProblem[] = [
  { id: '1', title: 'Two Sum', difficulty: 'easy', category: 'Arrays', tags: ['hash-map', 'array'], solved: true, acceptance_rate: 89, description: 'Find two numbers that add up to target.' },
  { id: '2', title: 'Valid Parentheses', difficulty: 'easy', category: 'Stacks', tags: ['stack', 'string'], solved: true, acceptance_rate: 76, description: 'Check if parentheses are balanced.' },
  { id: '3', title: 'LRU Cache', difficulty: 'medium', category: 'Design', tags: ['hash-map', 'linked-list', 'design'], solved: false, acceptance_rate: 42, description: 'Design a Least Recently Used cache.' },
  { id: '4', title: 'Course Schedule', difficulty: 'medium', category: 'Graphs', tags: ['graph', 'topological-sort'], solved: false, acceptance_rate: 51, description: 'Determine if you can finish all courses.' },
  { id: '5', title: 'Trapping Rain Water', difficulty: 'hard', category: 'Arrays', tags: ['two-pointer', 'stack', 'dp'], solved: false, acceptance_rate: 35, description: 'Calculate trapped rain water.' },
]

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
  const { arenaStats, loading, refresh } = useNewtonData()
  const [search, setSearch] = useState('')
  const [difficulty, setDifficulty] = useState<string | null>(null)
  const [category, setCategory] = useState<string | null>(null)
  const [showSolved, setShowSolved] = useState(true)

  const stats = useMemo(() => parseToolText(arenaStats), [arenaStats])
  const problems = FALLBACK_PROBLEMS // Arena problems come from search_practice_questions, not bulk fetch
  const totalSolved = stats?.solved_questions_count ?? problems.filter((p) => p.solved).length

  const categories = useMemo(
    () => Array.from(new Set(problems.map((p) => p.category))),
    [problems]
  )

  const filtered = useMemo(() => {
    return problems.filter((p) => {
      if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false
      if (difficulty && p.difficulty !== difficulty) return false
      if (category && p.category !== category) return false
      if (!showSolved && p.solved) return false
      return true
    })
  }, [problems, search, difficulty, category, showSolved])

  if (loading) return <ArenaSkeleton />

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
              <div className="space-y-2">
                {filtered.map((problem) => (
                  <ProblemCard key={problem.id} problem={problem} />
                ))}
                {filtered.length === 0 && (
                  <div className="text-center py-12 text-sm text-[hsl(var(--muted-foreground))]">
                    No problems match your filters.
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
