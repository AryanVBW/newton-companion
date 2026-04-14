import { useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, BookOpen, PlayCircle, FileText, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { Lecture } from '@/types/newton'

interface RecoveryPanelProps {
  lecture: Lecture
}

function RecoveryPanel({ lecture }: RecoveryPanelProps) {
  const [loading, setLoading] = useState(false)
  const [recovery, setRecovery] = useState<{
    summary: string
    keyTopics: string[]
    resources: { title: string; type: string }[]
  } | null>(null)

  const generateRecovery = async () => {
    setLoading(true)
    await new Promise((r) => setTimeout(r, 2000))
    setRecovery({
      summary:
        'This lecture covered binary search trees, including insertion, deletion, and traversal operations. Key focus was on balanced BSTs and their time complexity analysis.',
      keyTopics: [
        'BST insertion and deletion',
        'Inorder, preorder, postorder traversal',
        'AVL trees introduction',
        'Time complexity: O(log n) average',
      ],
      resources: [
        { title: 'BST Visualization Tool', type: 'interactive' },
        { title: 'Lecture Recording', type: 'video' },
        { title: 'Practice Problems Set', type: 'problems' },
      ],
    })
    setLoading(false)
  }

  if (!recovery && !loading) {
    return (
      <div className="mt-4 p-4 rounded-lg border border-dashed border-[hsl(var(--border))] text-center">
        <Sparkles className="h-8 w-8 text-[hsl(var(--primary))] mx-auto mb-2" />
        <p className="text-sm font-medium mb-1">Smart Recovery</p>
        <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3">
          Get an AI-powered summary and recovery plan for this missed lecture.
        </p>
        <Button size="sm" onClick={generateRecovery} className="gap-2">
          <Sparkles className="h-3.5 w-3.5" />
          Generate Recovery Plan
        </Button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="mt-4 p-6 rounded-lg border border-[hsl(var(--border))] flex flex-col items-center">
        <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--primary))] mb-2" />
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Analyzing lecture content...</p>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 space-y-3"
    >
      <div className="flex items-center gap-2 text-sm font-medium text-[hsl(var(--primary))]">
        <Sparkles className="h-4 w-4" />
        Recovery Plan
      </div>

      <Card>
        <CardContent className="p-4">
          <h4 className="text-sm font-medium mb-1">Summary</h4>
          <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">{recovery!.summary}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <h4 className="text-sm font-medium mb-2">Key Topics</h4>
          <ul className="space-y-1.5">
            {recovery!.keyTopics.map((topic, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                <BookOpen className="h-3 w-3 mt-0.5 shrink-0" />
                {topic}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <h4 className="text-sm font-medium mb-2">Recommended Resources</h4>
          <div className="space-y-2">
            {recovery!.resources.map((res, i) => (
              <button
                key={i}
                className="flex items-center gap-2 w-full text-left text-xs hover:text-[hsl(var(--primary))] transition-colors cursor-pointer"
              >
                {res.type === 'video' ? (
                  <PlayCircle className="h-3.5 w-3.5" />
                ) : (
                  <FileText className="h-3.5 w-3.5" />
                )}
                {res.title}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export { RecoveryPanel }
