import { cn } from '@/lib/cn'

interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  className?: string
  disabled?: boolean
  id?: string
}

function Switch({ checked, onCheckedChange, className, disabled, id }: SwitchProps) {
  return (
    <button
      id={id}
      role="switch"
      type="button"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-[22px] w-[40px] shrink-0 cursor-pointer items-center rounded-full transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-40',
        className
      )}
      style={{
        background: checked
          ? 'linear-gradient(135deg, #78C7CE 0%, #7E9ACF 100%)'
          : 'hsl(var(--input))',
        boxShadow: checked ? '0 0 10px rgba(120,199,206,0.3)' : 'none',
      }}
    >
      <span
        className="pointer-events-none block rounded-full bg-white shadow-md ring-0 transition-transform duration-200"
        style={{
          width: 16,
          height: 16,
          transform: checked ? 'translateX(20px)' : 'translateX(3px)',
          boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
        }}
      />
    </button>
  )
}

export { Switch }
