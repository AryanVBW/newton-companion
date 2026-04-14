import { cn } from '@/lib/cn'

interface SeparatorProps {
  orientation?: 'horizontal' | 'vertical'
  className?: string
}

function Separator({ orientation = 'horizontal', className }: SeparatorProps) {
  return (
    <div
      role="separator"
      className={cn(
        'shrink-0 bg-[hsl(var(--border))]',
        orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]',
        className
      )}
    />
  )
}

export { Separator }
