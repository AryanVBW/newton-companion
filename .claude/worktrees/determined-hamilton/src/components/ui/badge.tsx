import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:ring-offset-2',
        {
          'border-transparent bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]':
            variant === 'default',
          'border-transparent bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]':
            variant === 'secondary',
          'border-transparent bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))]':
            variant === 'destructive',
          'text-[hsl(var(--foreground))]': variant === 'outline',
          'border-transparent bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]':
            variant === 'success',
          'border-transparent bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]':
            variant === 'warning',
        },
        className
      )}
      {...props}
    />
  )
}

export { Badge }
