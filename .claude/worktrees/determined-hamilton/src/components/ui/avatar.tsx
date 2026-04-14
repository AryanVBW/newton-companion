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
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
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
          className="flex h-full w-full items-center justify-center bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] font-medium"
        >
          {fallback.slice(0, 2).toUpperCase()}
        </div>
      )}
    </div>
  )
}

export { Avatar }
