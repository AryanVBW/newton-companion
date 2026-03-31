import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send,
  Bot,
  Zap,
  Brain,
  Loader2,
  CheckCircle2,
  XCircle,
  Wrench,
  RefreshCw,
} from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageBubble } from './message-bubble'
import { ToolCallCard } from './tool-call-card'
import { useBrainStore } from '@/stores/brain-store'
import type { ChatMessage, ChatToolCall } from '@/types/ai'

const SUGGESTIONS = [
  'How am I doing?',
  'What did I miss?',
  'Practice problems for DSA',
  "Summarize today's lectures",
]

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: '1',
    role: 'assistant',
    content:
      "Hi! I'm your Newton Companion AI — powered by the Agent Brain. I can help you track progress, catch up on lectures, find practice problems, and more. Ask me anything, or give me a goal and I'll handle it autonomously.",
    timestamp: new Date(Date.now() - 60000).toISOString(),
  },
]

function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES)
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [chatHistory, setChatHistory] = useState<unknown[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  // Brain store for autonomous goal execution
  const brainStore = useBrainStore()

  // Init brain event listener
  useEffect(() => {
    brainStore.init()
    return () => brainStore.cleanup()
  }, [])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isTyping, brainStore.events])

  const sendMessage = async (text: string) => {
    if (!text.trim()) return

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsTyping(true)

    try {
      // Call the real AI backend
      const result = await invoke<{
        response: string
        messages: unknown[]
        tool_server_map?: Record<string, string>
      }>('ai_chat', {
        message: text.trim(),
        history: chatHistory.length > 0 ? chatHistory : null,
      })

      const serverMap = result.tool_server_map ?? {}

      // Extract tool calls from the message history if present
      const toolCalls: ChatToolCall[] = []
      if (result.messages) {
        for (const msg of result.messages as Array<{
          role: string
          tool_calls?: Array<{
            id: string
            function: { name: string; arguments: string }
          }>
          tool_call_id?: string
          content?: string
        }>) {
          if (msg.role === 'assistant' && msg.tool_calls) {
            for (const tc of msg.tool_calls) {
              // Use the actual server name from the map; fall back to "MCP"
              const serverName = serverMap[tc.function.name] ?? 'MCP'
              toolCalls.push({
                id: tc.id,
                tool_name: tc.function.name,
                server_name: serverName,
                arguments: JSON.parse(tc.function.arguments || '{}'),
                is_loading: false,
                is_error: false,
              })
            }
          }
          // Match tool results to tool calls
          if (msg.role === 'tool' && msg.tool_call_id) {
            const matching = toolCalls.find((tc) => tc.id === msg.tool_call_id)
            if (matching) {
              matching.result = msg.content || ''
            }
          }
        }
      }

      const aiMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: result.response,
        timestamp: new Date().toISOString(),
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      }

      setMessages((prev) => [...prev, aiMsg])
      setChatHistory(result.messages || [])
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : String(error)

      const aiMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `I encountered an error: ${errorMsg}\n\nPlease check that your AI provider is configured in Settings.`,
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, aiMsg])
    } finally {
      setIsTyping(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-full"
    >
      {/* Brain Status Bar */}
      {brainStore.isRunning && (
        <div className="px-6 py-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--accent))]/30">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <Brain className="h-4 w-4 text-[hsl(var(--primary))] animate-pulse" />
            <div className="flex-1">
              <p className="text-xs font-medium text-[hsl(var(--foreground))]">
                Brain is working
                {brainStore.activeGoalDescription
                  ? `: ${brainStore.activeGoalDescription}`
                  : '...'}
              </p>
              {brainStore.progress && (
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1.5 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-[hsl(var(--primary))]"
                      initial={{ width: 0 }}
                      animate={{
                        width: `${
                          brainStore.progress.totalSteps > 0
                            ? (brainStore.progress.completedSteps /
                                brainStore.progress.totalSteps) *
                              100
                            : 0
                        }%`,
                      }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                    {brainStore.progress.completedSteps}/
                    {brainStore.progress.totalSteps}
                  </span>
                </div>
              )}
              {brainStore.progress?.currentStep && (
                <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5 truncate">
                  {brainStore.progress.currentStep}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => brainStore.cancelGoal()}
              className="text-xs h-6 px-2"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Brain Events Feed */}
      <AnimatePresence>
        {brainStore.events.length > 0 && brainStore.isRunning && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-6 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]/50 overflow-hidden"
          >
            <div className="max-w-2xl mx-auto py-2 space-y-1">
              {brainStore.events.slice(-5).map((evt, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-[11px] text-[hsl(var(--muted-foreground))]"
                >
                  <BrainEventIcon event={evt.event} />
                  <span className="truncate">
                    <BrainEventLabel event={evt} />
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <ScrollArea ref={scrollRef} className="flex-1 px-6 py-4">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.map((msg) => (
            <div key={msg.id}>
              {msg.tool_calls?.map((tc) => (
                <ToolCallCard key={tc.id} toolCall={tc} />
              ))}
              <MessageBubble message={msg} />
            </div>
          ))}

          {isTyping && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--muted))] shrink-0">
                <Bot className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
              </div>
              <div className="bg-[hsl(var(--muted))] rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex gap-1">
                  <span
                    className="h-2 w-2 rounded-full bg-[hsl(var(--muted-foreground))]/50 animate-bounce"
                    style={{ animationDelay: '0ms' }}
                  />
                  <span
                    className="h-2 w-2 rounded-full bg-[hsl(var(--muted-foreground))]/50 animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  />
                  <span
                    className="h-2 w-2 rounded-full bg-[hsl(var(--muted-foreground))]/50 animate-bounce"
                    style={{ animationDelay: '300ms' }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div className="px-6 pb-2">
          <div className="max-w-2xl mx-auto flex gap-2 flex-wrap">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                className="text-xs rounded-full border border-[hsl(var(--border))] px-3 py-1.5 hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-6 py-4 border-t border-[hsl(var(--border))]">
        <form
          onSubmit={handleSubmit}
          className="max-w-2xl mx-auto flex gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me anything about your courses..."
            className="flex-1"
            disabled={isTyping}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isTyping}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Brain event display helpers
// ---------------------------------------------------------------------------

function BrainEventIcon({ event }: { event: string }) {
  switch (event) {
    case 'goal_accepted':
      return <Zap className="h-3 w-3 text-yellow-500" />
    case 'planning_started':
    case 'plan_generated':
      return <Brain className="h-3 w-3 text-purple-500" />
    case 'step_started':
      return <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />
    case 'step_completed':
      return <CheckCircle2 className="h-3 w-3 text-green-500" />
    case 'step_healing':
    case 'replanning':
      return <RefreshCw className="h-3 w-3 text-orange-500" />
    case 'goal_completed':
      return <CheckCircle2 className="h-3 w-3 text-emerald-500" />
    case 'goal_failed':
      return <XCircle className="h-3 w-3 text-red-500" />
    case 'provider_switched':
      return <Wrench className="h-3 w-3 text-cyan-500" />
    default:
      return <Bot className="h-3 w-3" />
  }
}

function BrainEventLabel({ event }: { event: { event: string; data: Record<string, unknown> } }) {
  const d = event.data
  switch (event.event) {
    case 'goal_accepted':
      return <>Goal accepted: {String(d.description || '').slice(0, 60)}</>
    case 'planning_started':
      return <>Planning...</>
    case 'plan_generated':
      return (
        <>
          Plan ready: {String(d.step_count)} steps — {String(d.reasoning || '').slice(0, 80)}
        </>
      )
    case 'step_started':
      return <>Step {String(d.step_id)}: {String(d.description || '').slice(0, 60)}</>
    case 'step_completed':
      return (
        <>
          Step {String(d.step_id)} {d.success ? '✓' : '✗'}: {String(d.output_preview || '').slice(0, 60)}
        </>
      )
    case 'step_healing':
      return <>Healing step {String(d.step_id)}: {String(d.strategy || '')}</>
    case 'replanning':
      return <>Replanning: {String(d.reason || '').slice(0, 60)}</>
    case 'goal_completed':
      return <>Done: {String(d.summary || '').slice(0, 80)}</>
    case 'goal_failed':
      return <>Failed: {String(d.error || '').slice(0, 80)}</>
    case 'provider_switched':
      return (
        <>
          Switched {String(d.from)} → {String(d.to)}: {String(d.reason || '').slice(0, 40)}
        </>
      )
    default:
      return <>{event.event}</>
  }
}

export { ChatPage }
