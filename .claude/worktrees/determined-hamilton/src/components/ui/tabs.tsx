import { createContext, useContext, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface TabsContextValue {
  activeTab: string
  setActiveTab: (tab: string) => void
}

const TabsContext = createContext<TabsContextValue | null>(null)

function useTabs() {
  const ctx = useContext(TabsContext)
  if (!ctx) throw new Error('useTabs must be used within Tabs')
  return ctx
}

interface TabsProps {
  defaultValue: string
  value?: string
  onValueChange?: (value: string) => void
  children: ReactNode
  className?: string
}

function Tabs({ defaultValue, value, onValueChange, children, className }: TabsProps) {
  const [internal, setInternal] = useState(defaultValue)
  const activeTab = value ?? internal
  const setActiveTab = onValueChange ?? setInternal

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={cn('w-full', className)}>{children}</div>
    </TabsContext.Provider>
  )
}

interface TabsListProps {
  children: ReactNode
  className?: string
}

function TabsList({ children, className }: TabsListProps) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex h-10 items-center justify-center rounded-[var(--radius)] bg-[hsl(var(--muted))] p-1 text-[hsl(var(--muted-foreground))]',
        className
      )}
    >
      {children}
    </div>
  )
}

interface TabsTriggerProps {
  value: string
  children: ReactNode
  className?: string
}

function TabsTrigger({ value, children, className }: TabsTriggerProps) {
  const { activeTab, setActiveTab } = useTabs()
  const isActive = activeTab === value

  return (
    <button
      role="tab"
      aria-selected={isActive}
      onClick={() => setActiveTab(value)}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]',
        'cursor-pointer',
        isActive && 'bg-[hsl(var(--background))] text-[hsl(var(--foreground))] shadow-sm',
        className
      )}
    >
      {children}
    </button>
  )
}

interface TabsContentProps {
  value: string
  children: ReactNode
  className?: string
}

function TabsContent({ value, children, className }: TabsContentProps) {
  const { activeTab } = useTabs()
  if (activeTab !== value) return null

  return (
    <div role="tabpanel" className={cn('mt-2', className)}>
      {children}
    </div>
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
