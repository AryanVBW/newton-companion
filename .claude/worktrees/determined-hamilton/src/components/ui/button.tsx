import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        className={cn(
          'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius)] text-sm font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50',
          'cursor-pointer',
          {
            'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90':
              variant === 'default',
            'bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] hover:bg-[hsl(var(--secondary))]/80':
              variant === 'secondary',
            'border border-[hsl(var(--input))] bg-transparent hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]':
              variant === 'outline',
            'hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]':
              variant === 'ghost',
            'bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))] hover:bg-[hsl(var(--destructive))]/90':
              variant === 'destructive',
            'text-[hsl(var(--primary))] underline-offset-4 hover:underline': variant === 'link',
          },
          {
            'h-10 px-4 py-2': size === 'default',
            'h-9 rounded-md px-3': size === 'sm',
            'h-11 rounded-md px-8': size === 'lg',
            'h-10 w-10': size === 'icon',
          },
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button }
