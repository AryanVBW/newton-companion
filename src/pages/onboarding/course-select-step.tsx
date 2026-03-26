import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { GraduationCap, BookOpen, ChevronRight, Loader2, WifiOff } from 'lucide-react'
import { cn } from '@/lib/cn'
import { invoke } from '@/lib/tauri'

interface CourseOption {
  course_hash: string
  course_name: string
  semester_name: string | null
  is_primary: boolean
  subjects: { name: string; subject_hash: string }[]
}

interface CourseSelectStepProps {
  onNext: (courseHash: string, courseName: string, semesterName: string | null) => void
  onBack: () => void
}

function parseToolText(data: any): any {
  try {
    if (!data) return null
    const text = data?.content?.[0]?.text
    if (text) return JSON.parse(text)
    return data
  } catch {
    return data
  }
}

function CourseSelectStep({ onNext, onBack }: CourseSelectStepProps) {
  const [courses, setCourses] = useState<CourseOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string>('')

  // Fetch courses from the MCP server
  useEffect(() => {
    async function fetchCourses() {
      setLoading(true)
      setError(null)
      try {
        const result = await invoke<any>('mcp_call_tool', {
          serverId: 'newton-school',
          toolName: 'list_courses',
          args: {},
        })
        const parsed = parseToolText(result)
        const courseList: CourseOption[] = parsed?.courses || []
        setCourses(courseList)
        // Auto-select primary course
        const primary = courseList.find((c) => c.is_primary)
        if (primary) setSelected(primary.course_hash)
        else if (courseList.length > 0) setSelected(courseList[0].course_hash)
      } catch (err: any) {
        setError('Could not load courses. Make sure your device is linked.')
      } finally {
        setLoading(false)
      }
    }
    fetchCourses()
  }, [])

  const selectedCourse = courses.find((c) => c.course_hash === selected)

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -40 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col items-center py-16"
      >
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--primary))] mb-4" />
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading your courses...</p>
      </motion.div>
    )
  }

  if (error || courses.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -40 }}
        transition={{ duration: 0.2 }}
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[hsl(var(--muted))] mb-4">
            <WifiOff className="w-8 h-8 text-[hsl(var(--muted-foreground))]" />
          </div>
          <h2 className="text-2xl font-bold">No Courses Found</h2>
          <p className="text-[hsl(var(--muted-foreground))] mt-2 max-w-sm mx-auto">
            {error || "We couldn't find any courses. Make sure your Newton School account is linked and you're enrolled in a course."}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="flex-1 py-3 rounded-xl border border-[hsl(var(--border))] text-[hsl(var(--foreground))] font-medium hover:bg-[hsl(var(--muted))] transition-colors"
          >
            Back
          </button>
          <button
            onClick={() => onNext('', '', null)}
            className="flex-1 py-3 rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-medium hover:opacity-90 transition-opacity"
          >
            Skip
          </button>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.2 }}
    >
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[hsl(var(--primary))]/10 mb-4">
          <GraduationCap className="w-8 h-8 text-[hsl(var(--primary))]" />
        </div>
        <h2 className="text-2xl font-bold">Select Your Course</h2>
        <p className="text-[hsl(var(--muted-foreground))] mt-2">
          Choose the course you want to track. You can change this later.
        </p>
      </div>

      <div className="space-y-3 mb-8">
        {courses.map((course) => (
          <button
            key={course.course_hash}
            onClick={() => setSelected(course.course_hash)}
            className={cn(
              'w-full text-left p-4 rounded-xl border-2 transition-all duration-200',
              selected === course.course_hash
                ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5 shadow-lg shadow-[hsl(var(--primary))]/10'
                : 'border-[hsl(var(--border))] hover:border-[hsl(var(--primary))]/30 bg-[hsl(var(--card))]'
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{course.course_name}</span>
                  {course.is_primary && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-medium">
                      PRIMARY
                    </span>
                  )}
                </div>
                {course.semester_name && (
                  <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
                    {course.semester_name}
                  </p>
                )}
                {course.subjects.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {course.subjects.map((s) => (
                      <span
                        key={s.subject_hash}
                        className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
                      >
                        <BookOpen className="w-3 h-3" />
                        {s.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div
                className={cn(
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1',
                  selected === course.course_hash
                    ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]'
                    : 'border-[hsl(var(--muted-foreground))]/30'
                )}
              >
                {selected === course.course_hash && (
                  <div className="w-2 h-2 rounded-full bg-white" />
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-3 rounded-xl border border-[hsl(var(--border))] text-[hsl(var(--foreground))] font-medium hover:bg-[hsl(var(--muted))] transition-colors"
        >
          Back
        </button>
        <button
          onClick={() => {
            if (selectedCourse) {
              onNext(selectedCourse.course_hash, selectedCourse.course_name, selectedCourse.semester_name)
            }
          }}
          disabled={!selected}
          className="flex-1 py-3 rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
        >
          Continue
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  )
}

export { CourseSelectStep }
