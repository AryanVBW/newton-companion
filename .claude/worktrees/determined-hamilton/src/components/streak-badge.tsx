import { Flame } from 'lucide-react'
import { cn } from '@/lib/cn'

interface StreakBadgeProps {
  count: number
  className?: string
}

function StreakBadge({ count, className }: StreakBadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-orange-500/10 px-3 py-1 text-sm font-semibold text-orange-500',
        className
      )}
    >
      <Flame className="h-4 w-4" />
      <span>{count} day streak</span>
    </div>
  )
}

export { StreakBadge }
