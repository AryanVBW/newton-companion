import { Trophy, Star, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ProgressRing } from '@/components/progress-ring'
import type { CourseOverview } from '@/types/newton'

interface CourseOverviewCardProps {
  data: CourseOverview
}

function CourseOverviewCard({ data }: CourseOverviewCardProps) {
  const lectureProgress = data.total_lectures > 0 ? data.lectures_attended / data.total_lectures : 0
  const assignProgress = data.total_assignments > 0 ? data.assignments_completed / data.total_assignments : 0
  const overallProgress = Math.round(((lectureProgress + assignProgress) / 2) * 100)

  return (
    <Card className="col-span-full lg:col-span-1">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{data.course_name}</CardTitle>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">{data.semester_name}</p>
          </div>
          <Badge variant="secondary" className="gap-1">
            <Trophy className="h-3 w-3" />
            Rank #{data.rank}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6 mb-6">
          <ProgressRing value={overallProgress} size={100} strokeWidth={7}>
            <div className="text-center">
              <span className="text-xl font-bold">{overallProgress}%</span>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Overall</p>
            </div>
          </ProgressRing>

          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-medium">{data.total_xp.toLocaleString()} XP</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[hsl(var(--primary))]" />
              <span className="text-sm font-medium">Level {data.current_level}</span>
            </div>
            <div className="text-xs text-[hsl(var(--muted-foreground))]">
              {data.rank} of {data.total_students} students
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Subjects</p>
          {data.subjects.map((subject) => (
            <div key={subject.name}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm truncate pr-4">{subject.name}</span>
                <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0">{subject.progress}%</span>
              </div>
              <Progress value={subject.progress} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export { CourseOverviewCard }
