import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Send, Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageBubble } from './message-bubble'
import { ToolCallCard } from './tool-call-card'
import type { ChatMessage, ChatToolCall } from '@/types/ai'

const SUGGESTIONS = [
  'How am I doing?',
  'What did I miss?',
  'Practice problems for DSA',
  'Summarize today\'s lectures',
]

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: '1',
    role: 'assistant',
    content:
      'Hi Vivek! I\'m your Newton Companion AI. I can help you track your progress, catch up on missed lectures, find practice problems, and more. What would you like to know?',
    timestamp: new Date(Date.now() - 60000).toISOString(),
  },
]

function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES)
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isTyping])

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

    // Simulate tool call + response
    await new Promise((r) => setTimeout(r, 800))

    const toolCall: ChatToolCall = {
      id: crypto.randomUUID(),
      tool_name: 'get_course_overview',
      server_name: 'Newton School',
      arguments: {},
      result: JSON.stringify({ rank: 23, total_xp: 12450, level: 8 }),
      is_loading: false,
      is_error: false,
    }

    await new Promise((r) => setTimeout(r, 1200))

    const aiMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: getAiResponse(text),
      timestamp: new Date().toISOString(),
      tool_calls: [toolCall],
    }

    setMessages((prev) => [...prev, aiMsg])
    setIsTyping(false)
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

function getAiResponse(input: string): string {
  const lower = input.toLowerCase()
  if (lower.includes('doing') || lower.includes('progress')) {
    return "You're doing great! You're ranked #23 out of 156 students with 12,450 XP at Level 8. Your DSA progress is at 78%, Math at 65%, and AI Foundations at 82%. You've attended 45 out of 52 lectures (87%) and completed 18 out of 22 assignments. Keep up the momentum!"
  }
  if (lower.includes('miss') || lower.includes('missed')) {
    return "You've missed 2 lectures recently:\n\n1. **Graph Algorithms** (Mar 21) - Covered BFS, DFS, and shortest path algorithms. A recording is available.\n\n2. **Calculus - Integration** (Mar 17) - Covered definite integrals and integration techniques.\n\nI'd recommend watching the Graph Algorithms recording first since it's a prerequisite for upcoming topics. Want me to create a recovery plan?"
  }
  if (lower.includes('practice') || lower.includes('problem')) {
    return "Based on your current progress, I recommend these practice problems:\n\n1. **LRU Cache** (Medium) - Great for your upcoming design patterns module\n2. **Course Schedule** (Medium) - Builds on the graph algorithms you're learning\n3. **Longest Increasing Subsequence** (Medium) - Good DP practice before your exam\n\nYou've solved 142 problems so far. Want me to filter by a specific topic?"
  }
  if (lower.includes('lecture') || lower.includes('today') || lower.includes('summarize')) {
    return "Here's your schedule for today:\n\n- **9:00 AM** - Data Structures & Algorithms (Binary Search Trees)\n- **11:00 AM** - Mathematics Tutorial\n- **3:00 PM** - Foundations of AI\n\nYour DSA Assignment #5 is also due at 2:00 PM today. Make sure to submit it before the deadline!"
  }
  return "I'd be happy to help with that! I can look up your course data, check your assignment status, find practice problems, or help you catch up on missed lectures. What would you like to know more about?"
}

export { ChatPage }
