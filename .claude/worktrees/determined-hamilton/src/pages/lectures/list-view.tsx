import { Badge } from '@/components/ui/badge'
import { Clock, User } from 'lucide-react'
import { cn } from '@/lib/cn'
import { format, isThisWeek, parseISO } from 'date-fns'
import type { Lecture } from '@/types/newton'

interface ListViewProps {
  lectures: Lecture[]
  onSelectLecture: (lecture: Lecture) => void
  selectedLecture: Lecture | null
}

const statusConfig: Record<string, { label: string; variant: 'success' | 'destructive' | 'default' | 'secondary' }> = {
  attended: { label: 'Attended', variant: 'success' },
  missed: { label: 'Missed', variant: 'destructive' },
  upcoming: { label: 'Upcoming', variant: 'default' },
  recording: { label: 'Recording Available', variant: 'secondary' },
}

function groupByWeek(lectures: Lecture[]): { label: string; items: Lecture[] }[] {
  const groups: Map<string, Lecture[]> = new Map()
  const sorted = [...lectures].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  for (const lecture of sorted) {
    const d = parseISO(lecture.date)
    const label = isThisWeek(d) ? 'This Week' : `Week of ${format(d, 'MMM d')}`
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label)!.push(lecture)
  }

  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }))
}

function ListView({ lectures, onSelectLecture, selectedLecture }: ListViewProps) {
  const grouped = groupByWeek(lectures)

  return (
    <div className="space-y-6">
      {grouped.map((group) => (
        <div key={group.label}>
          <h3 className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-3 px-1">
            {group.label}
          </h3>
          <div className="space-y-2">
            {group.items.map((lecture) => {
              const config = statusConfig[lecture.status]
              const isSelected = selectedLecture?.id === lecture.id

              return (
                <button
                  key={lecture.id}
                  onClick={() => onSelectLecture(lecture)}
                  className={cn(
                    'w-full text-left rounded-lg border p-4 transition-all cursor-pointer',
                    'hover:border-[hsl(var(--primary))]/30 hover:bg-[hsl(var(--muted))]/50',
                    isSelected
                      ? 'border-[hsl(var(--primary))]/50 bg-[hsl(var(--primary))]/5'
                      : 'border-[hsl(var(--border))]'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{lecture.title}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{lecture.subject}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-[hsl(var(--muted-foreground))]">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {lecture.instructor}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {lecture.start_time} - {lecture.end_time}
                        </span>
                      </div>
                    </div>
                    <Badge variant={config.variant} className="shrink-0">
                      {config.label}
                    </Badge>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export { ListView }
