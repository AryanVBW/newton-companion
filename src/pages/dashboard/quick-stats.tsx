import { BookOpen, ClipboardCheck, Code2, Trophy } from 'lucide-react'

interface QuickStatsProps {
  data: {
    lecturesPercent: number
    assignmentsDone: number
    totalAssignments: number
    problemsSolved: number
    rank: number
  }
}

const STATS = (data: QuickStatsProps['data']) => [
  {
    label: 'Lectures Attended',
    value: `${data.lecturesPercent}%`,
    icon: BookOpen,
    teal: 'hsl(var(--newton-teal))',
    bg: 'hsl(var(--newton-teal) / 0.08)',
    border: 'hsl(var(--newton-teal) / 0.18)',
  },
  {
    label: 'Assignments Done',
    value: `${data.assignmentsDone}/${data.totalAssignments}`,
    icon: ClipboardCheck,
    teal: 'hsl(var(--newton-seafoam))',
    bg: 'hsl(var(--newton-seafoam) / 0.08)',
    border: 'hsl(var(--newton-seafoam) / 0.18)',
  },
  {
    label: 'Problems Solved',
    value: `${data.problemsSolved}`,
    icon: Code2,
    teal: 'hsl(var(--newton-blue))',
    bg: 'hsl(var(--newton-blue) / 0.08)',
    border: 'hsl(var(--newton-blue) / 0.18)',
  },
  {
    label: 'Current Rank',
    value: data.rank > 0 ? `#${data.rank}` : '—',
    icon: Trophy,
    teal: 'hsl(43 90% 56%)',
    bg: 'hsl(43 90% 56% / 0.08)',
    border: 'hsl(43 90% 56% / 0.18)',
  },
]

function QuickStats({ data }: QuickStatsProps) {
  const stats = STATS(data)

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-xl p-4 transition-all duration-200 hover:scale-[1.015] hover:-translate-y-0.5"
          style={{
            background: 'hsl(var(--card))',
            border: `1px solid ${stat.border}`,
            boxShadow: `0 1px 3px rgba(0,0,0,0.05), 0 4px 16px ${stat.bg}`,
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0"
              style={{ background: stat.bg, border: `1px solid ${stat.border}` }}
            >
              <stat.icon style={{ width: 16, height: 16, color: stat.teal }} />
            </div>
            <div>
              <p
                className="text-[22px] font-bold leading-none tracking-tight"
                style={{ color: stat.teal }}
              >
                {stat.value}
              </p>
              <p
                className="text-[11px] mt-1.5 leading-tight"
                style={{ color: 'hsl(var(--muted-foreground))' }}
              >
                {stat.label}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export { QuickStats }
