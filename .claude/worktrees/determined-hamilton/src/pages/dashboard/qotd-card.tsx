import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StreakBadge } from '@/components/streak-badge'
import { Zap, ArrowRight, CheckCircle2, HelpCircle } from 'lucide-react'

interface QotdData {
  title?: string
  difficulty?: string
  streak?: number
  completed_today?: boolean
  url?: string
  category?: string
}

interface QotdCardProps {
  data?: QotdData | null
}

const difficultyVariant: Record<string, 'success' | 'warning' | 'destructive'> = {
  easy: 'success',
  EASY: 'success',
  medium: 'warning',
  MEDIUM: 'warning',
  hard: 'destructive',
  HARD: 'destructive',
}

function QotdCard({ data }: QotdCardProps) {
  if (!data || !data.title) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-500" />
            Question of the Day
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <HelpCircle className="h-8 w-8 text-[hsl(var(--muted-foreground))]/50 mb-2" />
            <p className="text-sm text-[hsl(var(--muted-foreground))]">No question available</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const difficulty = (data.difficulty || '').toLowerCase()

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-500" />
            Question of the Day
          </CardTitle>
          {data.streak != null && data.streak > 0 && <StreakBadge count={data.streak} />}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="font-semibold mb-2">{data.title}</h3>
            <div className="flex items-center gap-2 mb-4">
              {difficulty && (
                <Badge variant={difficultyVariant[difficulty] || 'outline'}>
                  {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
                </Badge>
              )}
              {data.category && (
                <span className="text-xs text-[hsl(var(--muted-foreground))]">{data.category}</span>
              )}
            </div>
          </div>
        </div>

        {data.completed_today ? (
          <div className="flex items-center gap-2 text-green-500 text-sm">
            <CheckCircle2 className="h-4 w-4" />
            <span>Completed today!</span>
          </div>
        ) : (
          <Button
            size="sm"
            className="gap-2"
            onClick={() => {
              if (data.url) window.open(data.url, '_blank')
            }}
          >
            Solve Now
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

export { QotdCard }
