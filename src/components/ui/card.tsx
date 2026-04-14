import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-xl border bg-[hsl(var(--card))] text-[hsl(var(--card-foreground))]',
        'shadow-[0_1px_4px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04)]',
        'dark:shadow-[0_1px_4px_rgba(0,0,0,0.2),0_2px_12px_rgba(0,0,0,0.15)]',
        'hover:shadow-[0_2px_8px_rgba(0,0,0,0.08),0_4px_20px_rgba(0,0,0,0.06)]',
        'dark:hover:shadow-[0_2px_8px_rgba(0,0,0,0.25),0_4px_20px_rgba(0,0,0,0.18)]',
        'transition-shadow duration-200',
        className
      )}
      {...props}
    />
  )
)
Card.displayName = 'Card'

const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-5', className)} {...props} />
  )
)
CardHeader.displayName = 'CardHeader'

const CardTitle = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('text-[14.5px] font-semibold leading-none tracking-tight', className)}
      {...props}
    />
  )
)
CardTitle.displayName = 'CardTitle'

const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn('text-sm text-[hsl(var(--muted-foreground))]', className)}
      {...props}
    />
  )
)
CardDescription.displayName = 'CardDescription'

const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-5 pt-0', className)} {...props} />
  )
)
CardContent.displayName = 'CardContent'

const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center p-5 pt-0', className)} {...props} />
  )
)
CardFooter.displayName = 'CardFooter'

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
