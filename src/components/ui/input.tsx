import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

const Input = forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        'flex h-9 w-full rounded-lg border px-3 py-2 text-[13.5px] transition-all duration-150',
        'placeholder:text-[hsl(var(--muted-foreground))]',
        'focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'bg-[hsl(var(--card))] border-[hsl(var(--border))]',
        className
      )}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = 'hsl(var(--newton-teal) / 0.55)'
        e.currentTarget.style.boxShadow   = '0 0 0 3px hsl(var(--newton-teal) / 0.10)'
        props.onFocus?.(e)
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = ''
        e.currentTarget.style.boxShadow   = ''
        props.onBlur?.(e)
      }}
      ref={ref}
      {...props}
    />
  )
})
Input.displayName = 'Input'

export { Input }
