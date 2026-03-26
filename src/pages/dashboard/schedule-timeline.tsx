import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, Calendar } from 'lucide-react'
import { cn } from '@/lib/cn'

interface ScheduleEvent {
  id: string
  title: string
  type: string
  subject_name?: string
  start_time?: string
  end_time?: string
}

interface ScheduleTimelineProps {
  events?: ScheduleEvent[] | null
}

const typeColors: Record<string, string> = {
  lecture: 'bg-blue-500',
  assessment: 'bg-orange-500',
  contest: 'bg-red-500',
  event: 'bg-purple-500',
  assignment: 'bg-orange-500',
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  } catch {
    return ''
  }
}

function ScheduleTimeline({ events }: ScheduleTimelineProps) {
  const items = events || []

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Today's Schedule
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Calendar className="h-8 w-8 text-[hsl(var(--muted-foreground))]/50 mb-2" />
            <p className="text-sm text-[hsl(var(--muted-foreground))]">No events scheduled</p>
          </div>
        ) : (
          <div className="relative space-y-0">
            <div className="absolute left-[7px] top-2 bottom-2 w-[2px] bg-[hsl(var(--border))]" />
            {items.map((item) => (
              <div key={item.id} className="relative flex items-start gap-4 pb-5 last:pb-0">
                <div className={cn('relative z-10 mt-1.5 h-4 w-4 rounded-full border-2 border-[hsl(var(--background))]', typeColors[item.type] || 'bg-gray-500')} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium leading-tight">{item.title}</p>
                      {item.subject_name && (
                        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{item.subject_name}</p>
                      )}
                    </div>
                    {item.start_time && (
                      <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0">
                        {formatTime(item.start_time)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export { ScheduleTimeline }
