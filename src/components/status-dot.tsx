import { cn } from '@/lib/cn'

interface StatusDotProps {
  status: 'connected' | 'disconnected' | 'connecting' | 'error'
  className?: string
  showLabel?: boolean
}

const statusConfig = {
  connected: { color: 'bg-green-500', pulse: true, label: 'Connected' },
  disconnected: { color: 'bg-gray-400', pulse: false, label: 'Disconnected' },
  connecting: { color: 'bg-yellow-500', pulse: true, label: 'Connecting' },
  error: { color: 'bg-red-500', pulse: false, label: 'Error' },
}

function StatusDot({ status, className, showLabel }: StatusDotProps) {
  const config = statusConfig[status]

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <span className="relative flex h-2.5 w-2.5">
        {config.pulse && (
          <span
            className={cn(
              'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
              config.color
            )}
          />
        )}
        <span className={cn('relative inline-flex h-2.5 w-2.5 rounded-full', config.color)} />
      </span>
      {showLabel && (
        <span className="text-xs text-[hsl(var(--muted-foreground))]">{config.label}</span>
      )}
    </div>
  )
}

export { StatusDot }
