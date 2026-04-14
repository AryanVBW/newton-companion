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
      <div
        className="flex h-14 w-14 items-center justify-center rounded-2xl mb-4"
        style={{
          background: 'hsl(var(--newton-teal) / 0.08)',
          border: '1px solid hsl(var(--newton-teal) / 0.14)',
        }}
      >
        <Icon
          className="h-7 w-7"
          style={{ color: 'hsl(var(--newton-teal))' }}
        />
      </div>
      <h3 className="text-[15px] font-semibold mb-1.5">{title}</h3>
      <p
        className="text-[13px] max-w-sm mb-5 leading-relaxed"
        style={{ color: 'hsl(var(--muted-foreground))' }}
      >
        {description}
      </p>
      {actionLabel && onAction && (
        <Button onClick={onAction} size="sm">
          {actionLabel}
        </Button>
      )}
    </div>
  )
}

export { EmptyState }
