import { useState } from 'react'
import { cn } from '@/lib/cn'

interface AvatarProps {
  src?: string
  alt?: string
  fallback: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

function Avatar({ src, alt, fallback, size = 'md', className }: AvatarProps) {
  const [imgError, setImgError] = useState(false)

  const sizeClasses = {
    sm: 'h-7 w-7 text-[10px]',
    md: 'h-9 w-9 text-xs',
    lg: 'h-11 w-11 text-sm',
  }

  return (
    <div
      className={cn(
        'relative flex shrink-0 overflow-hidden rounded-full',
        sizeClasses[size],
        className
      )}
    >
      {src && !imgError ? (
        <img
          src={src}
          alt={alt ?? fallback}
          className="aspect-square h-full w-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center font-semibold tracking-wide"
          style={{
            background: 'linear-gradient(135deg, hsl(var(--newton-teal) / 0.8) 0%, hsl(var(--newton-blue) / 0.8) 100%)',
            color: '#fff',
          }}
        >
          {fallback.slice(0, 2).toUpperCase()}
        </div>
      )}
    </div>
  )
}

export { Avatar }
