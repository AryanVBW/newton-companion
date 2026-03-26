import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown, Wrench, CheckCircle2, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { ChatToolCall } from '@/types/ai'

interface ToolCallCardProps {
  toolCall: ChatToolCall
}

function ToolCallCard({ toolCall }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="flex justify-center my-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full max-w-md rounded-lg border bg-[hsl(var(--muted))]/50 overflow-hidden text-left cursor-pointer"
      >
        <div className="flex items-center gap-2 px-3 py-2">
          {toolCall.is_loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[hsl(var(--primary))]" />
          ) : toolCall.is_error ? (
            <AlertCircle className="h-3.5 w-3.5 text-red-500" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          )}

          <Wrench className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />

          <span className="text-xs font-medium flex-1 truncate">
            {toolCall.server_name} / {toolCall.tool_name}
          </span>

          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 text-[hsl(var(--muted-foreground))] transition-transform',
              expanded && 'rotate-180'
            )}
          />
        </div>

        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            className="border-t px-3 py-2"
          >
            <div className="mb-2">
              <p className="text-[10px] font-medium text-[hsl(var(--muted-foreground))] uppercase mb-1">Arguments</p>
              <pre className="text-[11px] text-[hsl(var(--muted-foreground))] bg-[hsl(var(--background))] rounded p-2 overflow-x-auto">
                {JSON.stringify(toolCall.arguments, null, 2)}
              </pre>
            </div>
            {toolCall.result && (
              <div>
                <p className="text-[10px] font-medium text-[hsl(var(--muted-foreground))] uppercase mb-1">Result</p>
                <pre className="text-[11px] text-[hsl(var(--muted-foreground))] bg-[hsl(var(--background))] rounded p-2 overflow-x-auto max-h-32">
                  {toolCall.result}
                </pre>
              </div>
            )}
          </motion.div>
        )}
      </button>
    </div>
  )
}

export { ToolCallCard }
