import { BookOpen, ClipboardCheck, Code2, Trophy } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/cn'

interface QuickStatsProps {
  data: {
    lecturesPercent: number
    assignmentsDone: number
    totalAssignments: number
    problemsSolved: number
    rank: number
  }
}

function QuickStats({ data }: QuickStatsProps) {
  const stats = [
    {
      label: 'Lectures Attended',
      value: `${data.lecturesPercent}%`,
      icon: BookOpen,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: 'Assignments Done',
      value: `${data.assignmentsDone}/${data.totalAssignments}`,
      icon: ClipboardCheck,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      label: 'Problems Solved',
      value: `${data.problemsSolved}`,
      icon: Code2,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      label: 'Current Rank',
      value: data.rank > 0 ? `#${data.rank}` : '--',
      icon: Trophy,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', stat.bgColor)}>
                <stat.icon className={cn('h-5 w-5', stat.color)} />
              </div>
              <div>
                <p className="text-2xl font-bold leading-none">{stat.value}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{stat.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export { QuickStats }
