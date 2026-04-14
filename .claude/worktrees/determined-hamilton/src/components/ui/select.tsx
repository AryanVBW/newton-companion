import { useState, useRef, useEffect, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/cn'

interface SelectProps {
  value: string
  onValueChange: (value: string) => void
  children: ReactNode
  placeholder?: string
  className?: string
}

interface SelectOption {
  value: string
  label: string
}

function Select({ value, onValueChange, placeholder = 'Select...', className, children }: SelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const options: SelectOption[] = []

  const extractOptions = (nodes: ReactNode) => {
    const arr = Array.isArray(nodes) ? nodes : [nodes]
    arr.forEach((child) => {
      if (child && typeof child === 'object' && 'props' in child) {
        if (child.props.value !== undefined) {
          options.push({ value: child.props.value, label: child.props.children as string })
        }
      }
    })
  }
  extractOptions(children)

  const selectedLabel = options.find((o) => o.value === value)?.label ?? placeholder

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-[var(--radius)] border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm',
          'focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]',
          'cursor-pointer',
          !value && 'text-[hsl(var(--muted-foreground))]'
        )}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown className={cn('ml-2 h-4 w-4 shrink-0 opacity-50 transition-transform', open && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.1 }}
            className="absolute z-50 mt-1 w-full rounded-[var(--radius)] border bg-[hsl(var(--popover))] p-1 shadow-md"
          >
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onValueChange(option.value)
                  setOpen(false)
                }}
                className={cn(
                  'flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))] transition-colors',
                  'cursor-pointer'
                )}
              >
                <Check
                  className={cn('mr-2 h-4 w-4', value === option.value ? 'opacity-100' : 'opacity-0')}
                />
                {option.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

interface SelectItemProps {
  value: string
  children: ReactNode
}

function SelectItem(_props: SelectItemProps) {
  return null
}

export { Select, SelectItem }
