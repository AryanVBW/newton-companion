import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Send, Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageBubble } from './message-bubble'
import { ToolCallCard } from './tool-call-card'
import { invoke } from '@/lib/tauri'
import type { ChatMessage, ChatToolCall, BackendChatMessage } from '@/types/ai'

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
      "Hi! I'm your Newton Companion AI. I can help you track your progress, catch up on missed lectures, find practice problems, and more. What would you like to know?",
    timestamp: new Date(Date.now() - 60000).toISOString(),
  },
]

function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES)
  const [history, setHistory] = useState<BackendChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isTyping])

  const sendMessage = async (text: string) => {
    if (!text.trim() || isTyping) return

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
      const prevLength = history.length
      const result = await invoke<{ response: string; messages: BackendChatMessage[] }>(
        'ai_chat',
        { message: text.trim(), history }
      )

      setHistory(result.messages)

      // Extract tool calls only from messages added in THIS turn (after prevLength + 1 for the user msg)
      const newMessages = result.messages.slice(prevLength + 1)
      const toolCalls: ChatToolCall[] = newMessages
        .filter((m) => m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0)
        .flatMap((m) =>
          (m.tool_calls ?? []).map((tc) => {
            const toolResult = newMessages.find(
              (r) => r.role === 'tool' && r.tool_call_id === tc.id
            )
            let parsedArgs: Record<string, unknown> = {}
            try { parsedArgs = JSON.parse(tc.function.arguments ?? '{}') } catch {}
            return {
              id: tc.id,
              tool_name: tc.function.name,
              server_name: 'Newton School',
              arguments: parsedArgs,
              result: typeof toolResult?.content === 'string' ? toolResult.content : '',
              is_loading: false,
              is_error: false,
            }
          })
        )

      const aiMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: result.response,
        timestamp: new Date().toISOString(),
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      }
      setMessages((prev) => [...prev, aiMsg])
    } catch (err: any) {
      const errText =
        String(err).includes('not configured') || String(err).includes('API key')
          ? 'AI is not configured yet. Go to Settings → AI Brain to add your API key.'
          : `Error: ${String(err)}`
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: errText,
          timestamp: new Date().toISOString(),
        },
      ])
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
                  <span className="h-2 w-2 rounded-full bg-[hsl(var(--muted-foreground))]/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="h-2 w-2 rounded-full bg-[hsl(var(--muted-foreground))]/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="h-2 w-2 rounded-full bg-[hsl(var(--muted-foreground))]/50 animate-bounce" style={{ animationDelay: '300ms' }} />
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
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me anything about your courses..."
            className="flex-1"
            disabled={isTyping}
          />
          <Button type="submit" size="icon" disabled={!input.trim() || isTyping}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </motion.div>
  )
}

export { ChatPage }
