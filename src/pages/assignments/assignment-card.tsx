import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Calendar, Clock } from 'lucide-react'
import { cn } from '@/lib/cn'
import { format, parseISO, isPast, differenceInHours } from 'date-fns'
import type { Assignment } from '@/types/newton'

interface AssignmentCardProps {
  assignment: Assignment
}

const statusConfig: Record<string, { label: string; variant: 'success' | 'destructive' | 'default' | 'warning' | 'secondary' }> = {
  pending: { label: 'Pending', variant: 'warning' },
  submitted: { label: 'Submitted', variant: 'default' },
  graded: { label: 'Graded', variant: 'success' },
  overdue: { label: 'Overdue', variant: 'destructive' },
}

const difficultyConfig: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' }> = {
  easy: { label: 'Easy', variant: 'success' },
  medium: { label: 'Medium', variant: 'warning' },
  hard: { label: 'Hard', variant: 'destructive' },
}

function AssignmentCard({ assignment }: AssignmentCardProps) {
  const status = statusConfig[assignment.status]
  const difficulty = difficultyConfig[assignment.difficulty]
  const dueDate = parseISO(assignment.due_date)
  const isOverdue = isPast(dueDate) && assignment.status === 'pending'
  const hoursLeft = differenceInHours(dueDate, new Date())
  const isUrgent = hoursLeft > 0 && hoursLeft < 24

  return (
    <div
      className={cn(
        'rounded-lg border p-4 transition-all hover:border-[hsl(var(--primary))]/30',
        isOverdue && 'border-red-500/30 bg-red-500/5',
        isUrgent && !isOverdue && 'border-yellow-500/30 bg-yellow-500/5'
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold truncate">{assignment.title}</h3>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{assignment.subject}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Badge variant={difficulty.variant} className="text-[10px]">
            {difficulty.label}
          </Badge>
          <Badge variant={status.variant} className="text-[10px]">
            {isOverdue ? 'Overdue' : status.label}
          </Badge>
        </div>
      </div>

      <p className="text-xs text-[hsl(var(--muted-foreground))] line-clamp-2 mb-3">
        {assignment.description}
      </p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-[hsl(var(--muted-foreground))]">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {format(dueDate, 'MMM d, yyyy')}
          </span>
          {isUrgent && !isOverdue && (
            <span className="flex items-center gap-1 text-yellow-500">
              <Clock className="h-3 w-3" />
              {hoursLeft}h left
            </span>
          )}
        </div>
        {assignment.score !== undefined && (
          <div className="flex items-center gap-2">
            <Progress value={assignment.score} max={assignment.max_score} className="w-16 h-1.5" />
            <span className="text-xs font-medium">
              {assignment.score}/{assignment.max_score}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export { AssignmentCard }
