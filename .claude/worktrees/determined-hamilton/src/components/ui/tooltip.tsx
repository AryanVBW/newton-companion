import { useState, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/cn'

interface TooltipProps {
  content: string
  children: ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  className?: string
}

function Tooltip({ content, children, side = 'top', className }: TooltipProps) {
  const [show, setShow] = useState(false)

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className={cn(
              'absolute z-50 rounded-md bg-[hsl(var(--popover))] px-3 py-1.5 text-xs text-[hsl(var(--popover-foreground))] shadow-md border whitespace-nowrap pointer-events-none',
              positionClasses[side],
              className
            )}
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export { Tooltip }
