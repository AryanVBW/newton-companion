/**
 * NewtonLogo — reusable logo component
 *
 * Usage:
 *   <NewtonLogo variant="icon"       size={32} />   — circular icon only (from logo.png)
 *   <NewtonLogo variant="wordmark"   height={20} />  — full SVG wordmark
 *   <NewtonLogo variant="lockup"     size={32} />   — icon + wordmark side by side
 */

interface LogoIconProps {
  size?: number
  className?: string
}

function LogoIcon({ size = 32, className }: LogoIconProps) {
  return (
    <img
      src="/logo.png"
      alt="Newton"
      width={size}
      height={size}
      className={className}
      style={{ borderRadius: 8, flexShrink: 0 }}
    />
  )
}

interface LogoWordmarkProps {
  height?: number
  /** 'dark' = as-is (dark paths), 'light' = inverted white for dark bg, 'auto' = no filter */
  theme?: 'dark' | 'light' | 'auto'
  className?: string
}

function LogoWordmark({ height = 18, theme = 'light', className }: LogoWordmarkProps) {
  const filter =
    theme === 'light'
      ? 'brightness(0) invert(1)'
      : theme === 'dark'
      ? 'none'
      : 'none'

  return (
    <img
      src="/logo.svg"
      alt="Newton School"
      height={height}
      className={className}
      style={{ width: 'auto', height, filter, flexShrink: 0 }}
    />
  )
}

interface LogoLockupProps {
  size?: number
  wordmarkHeight?: number
  theme?: 'dark' | 'light' | 'auto'
  className?: string
  gap?: number
}

function LogoLockup({
  size = 32,
  wordmarkHeight = 16,
  theme = 'light',
  className,
  gap = 10,
}: LogoLockupProps) {
  return (
    <div className={`flex items-center ${className ?? ''}`} style={{ gap }}>
      <LogoIcon size={size} />
      <LogoWordmark height={wordmarkHeight} theme={theme} />
    </div>
  )
}

export { LogoIcon, LogoWordmark, LogoLockup }
