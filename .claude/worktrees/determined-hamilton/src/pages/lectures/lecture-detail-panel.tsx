import { motion } from 'framer-motion'
import { X, Clock, User, Calendar, PlayCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { RecoveryPanel } from './recovery-panel'
import { format, parseISO } from 'date-fns'
import type { Lecture } from '@/types/newton'

interface LectureDetailPanelProps {
  lecture: Lecture
  onClose: () => void
}

const statusConfig: Record<string, { label: string; variant: 'success' | 'destructive' | 'default' | 'secondary' }> = {
  attended: { label: 'Attended', variant: 'success' },
  missed: { label: 'Missed', variant: 'destructive' },
  upcoming: { label: 'Upcoming', variant: 'default' },
  recording: { label: 'Recording Available', variant: 'secondary' },
}

function LectureDetailPanel({ lecture, onClose }: LectureDetailPanelProps) {
  const config = statusConfig[lecture.status]

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 250 }}
      className="w-[400px] h-full border-l border-[hsl(var(--border))] bg-[hsl(var(--card))] shrink-0"
    >
      <ScrollArea className="h-full">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex-1">
              <Badge variant={config.variant} className="mb-2">
                {config.label}
              </Badge>
              <h2 className="text-lg font-bold">{lecture.title}</h2>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">{lecture.subject}</p>
            </div>
            <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <Separator className="mb-4" />

          {/* Details */}
          <div className="space-y-3 mb-4">
            <div className="flex items-center gap-3 text-sm">
              <User className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
              <span>{lecture.instructor}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
              <span>{format(parseISO(lecture.date), 'EEEE, MMMM d, yyyy')}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Clock className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
              <span>{lecture.start_time} - {lecture.end_time}</span>
            </div>
          </div>

          {/* Description */}
          {lecture.description && (
            <>
              <Separator className="mb-4" />
              <div className="mb-4">
                <h3 className="text-sm font-medium mb-2">Description</h3>
                <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">
                  {lecture.description}
                </p>
              </div>
            </>
          )}

          {/* Topics */}
          {lecture.topics.length > 0 && (
            <>
              <Separator className="mb-4" />
              <div className="mb-4">
                <h3 className="text-sm font-medium mb-2">Topics Covered</h3>
                <div className="flex flex-wrap gap-2">
                  {lecture.topics.map((topic) => (
                    <Badge key={topic} variant="secondary" className="text-xs">
                      {topic}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Recording */}
          {(lecture.status === 'recording' || lecture.recording_url) && (
            <>
              <Separator className="mb-4" />
              <Button variant="outline" className="w-full gap-2">
                <PlayCircle className="h-4 w-4" />
                Watch Recording
              </Button>
            </>
          )}

          {/* Recovery panel for missed lectures */}
          {lecture.status === 'missed' && (
            <>
              <Separator className="my-4" />
              <RecoveryPanel lecture={lecture} />
            </>
          )}
        </div>
      </ScrollArea>
    </motion.div>
  )
}

export { LectureDetailPanel }
