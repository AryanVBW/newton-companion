import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar } from '@/components/ui/avatar'
import { Medal, Users } from 'lucide-react'
import { cn } from '@/lib/cn'

interface LeaderboardEntry {
  rank: number
  name: string
  xp: number
  level: number
  is_current_user?: boolean
}

interface LeaderboardWidgetProps {
  data?: { leaderboard?: LeaderboardEntry[]; self_rank?: any } | null
}

const medalColors: Record<number, string> = {
  1: 'text-yellow-500',
  2: 'text-gray-400',
  3: 'text-amber-600',
}

function LeaderboardWidget({ data }: LeaderboardWidgetProps) {
  const entries: LeaderboardEntry[] = data?.leaderboard || []

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Medal className="h-4 w-4" />
          Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Users className="h-8 w-8 text-[hsl(var(--muted-foreground))]/50 mb-2" />
            <p className="text-sm text-[hsl(var(--muted-foreground))]">No leaderboard data</p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry, i) => {
              const isUser = entry.is_current_user
              const showGap = i > 0 && entry.rank - entries[i - 1].rank > 1

              return (
                <div key={entry.rank}>
                  {showGap && (
                    <div className="flex items-center gap-2 py-1 px-3">
                      <span className="text-xs text-[hsl(var(--muted-foreground))]">...</span>
                    </div>
                  )}
                  <div
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 transition-colors',
                      isUser
                        ? 'bg-[hsl(var(--primary))]/10 border border-[hsl(var(--primary))]/20'
                        : 'hover:bg-[hsl(var(--muted))]'
                    )}
                  >
                    <span
                      className={cn(
                        'w-6 text-center text-sm font-bold',
                        medalColors[entry.rank] ?? 'text-[hsl(var(--muted-foreground))]'
                      )}
                    >
                      {entry.rank}
                    </span>
                    <Avatar fallback={entry.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-medium truncate', isUser && 'text-[hsl(var(--primary))]')}>
                        {entry.name}
                        {isUser && <span className="text-xs ml-1 opacity-60">(You)</span>}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{entry.xp.toLocaleString()}</p>
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Lvl {entry.level}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export { LeaderboardWidget }
