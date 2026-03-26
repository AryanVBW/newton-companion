import { Sparkles, ArrowRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const suggestions = [
  { title: 'Two Sum', difficulty: 'easy' as const, reason: 'Good warmup for hash maps' },
  { title: 'LRU Cache', difficulty: 'medium' as const, reason: 'Frequently asked in interviews' },
  { title: 'Merge K Sorted Lists', difficulty: 'hard' as const, reason: 'Builds on your recent heap study' },
]

const diffVariant = {
  easy: 'success' as const,
  medium: 'warning' as const,
  hard: 'destructive' as const,
}

function AiSuggestions() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-[hsl(var(--primary))]" />
          <h3 className="text-sm font-semibold">AI Recommended</h3>
        </div>
        <div className="space-y-2">
          {suggestions.map((s) => (
            <button
              key={s.title}
              className="flex items-center gap-3 w-full text-left rounded-lg p-2.5 hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{s.title}</span>
                  <Badge variant={diffVariant[s.difficulty]} className="text-[10px]">
                    {s.difficulty}
                  </Badge>
                </div>
                <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">{s.reason}</p>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export { AiSuggestions }
