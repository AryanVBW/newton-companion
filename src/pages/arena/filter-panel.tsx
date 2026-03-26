import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/cn'

interface FilterPanelProps {
  selectedDifficulty: string | null
  onDifficultyChange: (d: string | null) => void
  selectedCategory: string | null
  onCategoryChange: (c: string | null) => void
  categories: string[]
  showSolved: boolean
  onShowSolvedChange: (s: boolean) => void
}

const difficulties = ['easy', 'medium', 'hard']

function FilterPanel({
  selectedDifficulty,
  onDifficultyChange,
  selectedCategory,
  onCategoryChange,
  categories,
  showSolved,
  onShowSolvedChange,
}: FilterPanelProps) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-2">
          Difficulty
        </h4>
        <div className="flex flex-wrap gap-2">
          {difficulties.map((d) => (
            <button
              key={d}
              onClick={() => onDifficultyChange(selectedDifficulty === d ? null : d)}
              className="cursor-pointer"
            >
              <Badge
                variant={selectedDifficulty === d ? 'default' : 'outline'}
                className={cn(
                  'capitalize cursor-pointer',
                  selectedDifficulty === d && d === 'easy' && 'bg-green-500 hover:bg-green-600',
                  selectedDifficulty === d && d === 'medium' && 'bg-yellow-500 hover:bg-yellow-600',
                  selectedDifficulty === d && d === 'hard' && 'bg-red-500 hover:bg-red-600'
                )}
              >
                {d}
              </Badge>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-2">
          Category
        </h4>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => onCategoryChange(selectedCategory === c ? null : c)}
              className="cursor-pointer"
            >
              <Badge
                variant={selectedCategory === c ? 'default' : 'outline'}
                className="cursor-pointer"
              >
                {c}
              </Badge>
            </button>
          ))}
        </div>
      </div>

      <div>
        <button
          onClick={() => onShowSolvedChange(!showSolved)}
          className={cn(
            'text-xs transition-colors cursor-pointer',
            showSolved
              ? 'text-[hsl(var(--primary))]'
              : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
          )}
        >
          {showSolved ? 'Showing solved' : 'Hide solved'} problems
        </button>
      </div>
    </div>
  )
}

export { FilterPanel }
