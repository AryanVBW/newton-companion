import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  className?: string
}

function EmptyState({ icon: Icon, title, description, actionLabel, onAction, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-4 text-center', className)}>
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--muted))] mb-4">
        <Icon className="h-8 w-8 text-[hsl(var(--muted-foreground))]" />
      </div>
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      <p className="text-sm text-[hsl(var(--muted-foreground))] max-w-sm mb-4">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} size="sm">
          {actionLabel}
        </Button>
      )}
    </div>
  )
}

export { EmptyState }
