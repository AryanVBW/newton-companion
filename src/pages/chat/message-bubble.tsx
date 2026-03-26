import { cn } from '@/lib/cn'
import { Avatar } from '@/components/ui/avatar'
import { Bot } from 'lucide-react'
import type { ChatMessage } from '@/types/ai'

interface MessageBubbleProps {
  message: ChatMessage
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {isUser ? (
        <Avatar fallback="VS" size="sm" className="shrink-0 mt-0.5" />
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--muted))] shrink-0 mt-0.5">
          <Bot className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
        </div>
      )}

      <div
        className={cn(
          'max-w-[75%] rounded-2xl px-4 py-2.5',
          isUser
            ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-br-md'
            : 'bg-[hsl(var(--muted))] rounded-bl-md'
        )}
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        <p
          className={cn(
            'text-[10px] mt-1',
            isUser ? 'text-white/60' : 'text-[hsl(var(--muted-foreground))]'
          )}
        >
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}

export { MessageBubble }
