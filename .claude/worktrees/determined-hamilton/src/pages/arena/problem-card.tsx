import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Circle } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { ArenaProblem } from '@/types/newton'

interface ProblemCardProps {
  problem: ArenaProblem
}

const difficultyConfig = {
  easy: { variant: 'success' as const, color: 'text-green-500' },
  medium: { variant: 'warning' as const, color: 'text-yellow-500' },
  hard: { variant: 'destructive' as const, color: 'text-red-500' },
}

function ProblemCard({ problem }: ProblemCardProps) {
  const diff = difficultyConfig[problem.difficulty]

  return (
    <div
      className={cn(
        'rounded-lg border p-4 transition-all hover:border-[hsl(var(--primary))]/30 cursor-pointer',
        problem.solved && 'opacity-70'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          {problem.solved ? (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          ) : (
            <Circle className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-sm font-semibold">{problem.title}</h3>
            <Badge variant={diff.variant} className="shrink-0 text-[10px]">
              {problem.difficulty.charAt(0).toUpperCase() + problem.difficulty.slice(1)}
            </Badge>
          </div>

          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{problem.category}</p>

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {problem.tags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-[hsl(var(--muted-foreground))]"
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="mt-2 text-[10px] text-[hsl(var(--muted-foreground))]">
            Acceptance: {problem.acceptance_rate}%
          </div>
        </div>
      </div>
    </div>
  )
}

export { ProblemCard }
