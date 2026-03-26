import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from 'date-fns'
import type { Lecture } from '@/types/newton'

interface CalendarViewProps {
  lectures: Lecture[]
  onSelectDate: (date: Date) => void
  selectedDate: Date | null
}

const statusDotColors: Record<string, string> = {
  attended: 'bg-green-500',
  missed: 'bg-red-500',
  upcoming: 'bg-blue-500',
  recording: 'bg-gray-400',
}

function CalendarView({ lectures, onSelectDate, selectedDate }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(monthStart)
  const calStart = startOfWeek(monthStart)
  const calEnd = endOfWeek(monthEnd)

  const days: Date[] = []
  let day = calStart
  while (day <= calEnd) {
    days.push(day)
    day = addDays(day, 1)
  }

  const getLectureDots = (date: Date) => {
    return lectures.filter((l) => isSameDay(new Date(l.date), date))
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">
          {format(currentMonth, 'MMMM yyyy')}
        </h3>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 gap-0 mb-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="text-center text-xs font-medium text-[hsl(var(--muted-foreground))] py-2">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0">
        {days.map((d, i) => {
          const isCurrentMonth = isSameMonth(d, currentMonth)
          const isSelected = selectedDate && isSameDay(d, selectedDate)
          const isToday = isSameDay(d, new Date())
          const dots = getLectureDots(d)

          return (
            <button
              key={i}
              onClick={() => onSelectDate(d)}
              className={cn(
                'relative flex flex-col items-center justify-center h-12 rounded-lg transition-colors cursor-pointer',
                !isCurrentMonth && 'opacity-30',
                isSelected && 'bg-[hsl(var(--primary))]/10',
                isToday && !isSelected && 'bg-[hsl(var(--muted))]',
                'hover:bg-[hsl(var(--muted))]'
              )}
            >
              <span
                className={cn(
                  'text-sm',
                  isSelected && 'font-bold text-[hsl(var(--primary))]',
                  isToday && !isSelected && 'font-bold'
                )}
              >
                {format(d, 'd')}
              </span>
              {dots.length > 0 && (
                <div className="flex gap-0.5 mt-0.5">
                  {dots.slice(0, 3).map((lecture, j) => (
                    <div
                      key={j}
                      className={cn('h-1 w-1 rounded-full', statusDotColors[lecture.status])}
                    />
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export { CalendarView }
