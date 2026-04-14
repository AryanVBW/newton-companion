import { mapArenaProblem, parseToolText } from '@/lib/parse-tool-text'
import type {
  Assignment,
  AssignmentStatus,
  CourseListItem,
  CourseOverview,
  Difficulty,
  LeaderboardEntry,
  Lecture,
  LectureStatus,
  QOTD,
  ScheduleEvent,
  SubjectListItem,
  SubjectProgress,
} from '@/types/newton'

type JsonRecord = Record<string, unknown>

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === 'object' && value !== null
    ? (value as JsonRecord)
    : null
}

function asRecordArray(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonRecord => typeof item === 'object' && item !== null)
    : []
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function pickString(record: JsonRecord | null, keys: string[], fallback = ''): string {
  for (const key of keys) {
    const value = record?.[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value
    }
  }
  return fallback
}

function pickNumber(record: JsonRecord | null, keys: string[], fallback = 0): number {
  for (const key of keys) {
    const value = record?.[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
    if (typeof value === 'string') {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return fallback
}

function pickBoolean(record: JsonRecord | null, keys: string[], fallback = false): boolean {
  for (const key of keys) {
    const value = record?.[key]
    if (typeof value === 'boolean') return value
  }
  return fallback
}

function pickArray(record: JsonRecord | null, keys: string[]): unknown[] {
  for (const key of keys) {
    const value = record?.[key]
    if (Array.isArray(value)) return value
  }
  return []
}

function coerceDate(value: unknown): Date | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function toIsoDate(value: unknown): string {
  const date = coerceDate(value) ?? new Date()
  return date.toISOString()
}

function toDisplayTime(value: unknown): string {
  const date = coerceDate(value)
  if (!date) return ''
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function coerceLectureStatus(record: JsonRecord | null, startDate: Date | null): LectureStatus {
  if (pickBoolean(record, ['is_attended', 'attended'])) return 'attended'
  if (startDate && startDate > new Date()) return 'upcoming'
  if (pickBoolean(record, ['has_recording'])) return 'recording'
  return 'missed'
}

function coerceAssignmentStatus(record: JsonRecord | null, dueDate: Date | null): AssignmentStatus {
  const rawStatus = pickString(record, ['status']).toLowerCase()
  if (rawStatus === 'submitted' || rawStatus === 'graded' || rawStatus === 'overdue') {
    return rawStatus
  }

  if (dueDate && dueDate < new Date()) {
    return 'overdue'
  }

  return 'pending'
}

function coerceDifficulty(value: unknown): Difficulty {
  if (typeof value !== 'string') return 'medium'
  const normalized = value.toLowerCase()
  if (normalized === 'easy' || normalized === 'medium' || normalized === 'hard') {
    return normalized
  }
  return 'medium'
}

function stableId(record: JsonRecord | null, keys: string[], fallbackPrefix: string): string {
  const picked = pickString(record, keys)
  if (picked) return picked
  const title = pickString(record, ['title', 'name'], fallbackPrefix)
  const timestamp = pickString(record, ['start_timestamp', 'end_timestamp', 'due_date', 'time'])
  return `${fallbackPrefix}:${title}:${timestamp}`
}

function unwrapRecord(data: unknown): JsonRecord | null {
  return asRecord(parseToolText(data))
}

export function parseCourseList(data: unknown): CourseListItem[] {
  const root = unwrapRecord(data)
  const rawCourses = asRecordArray(root?.courses ?? (Array.isArray(parseToolText(data)) ? parseToolText(data) : []))

  return rawCourses.map((course) => ({
    course_hash: pickString(course, ['course_hash', 'hash', 'id']),
    course_name: pickString(course, ['course_name', 'course_title', 'name'], 'Untitled Course'),
    semester_name: asOptionalString(course.semester_name),
    is_primary: pickBoolean(course, ['is_primary']),
    is_ongoing_semester: pickBoolean(course, ['is_ongoing_semester']),
    subjects: asRecordArray(course.subjects).map((subject): SubjectListItem => ({
      name: pickString(subject, ['name', 'subject_name']),
      subject_hash: pickString(subject, ['subject_hash', 'hash', 'id']),
    })),
  }))
}

export function parseCourseOverview(data: unknown): CourseOverview | null {
  const root = unwrapRecord(data)
  if (!root) return null

  const xp = asRecord(root.xp)
  const performance = asRecord(root.performance)
  const totalXp = pickNumber(root, ['total_xp', 'total_earned_points'], pickNumber(xp, ['total_earned']))

  const subjects = asRecordArray(root.subjects).map((subject): SubjectProgress => ({
    name: pickString(subject, ['name', 'subject_name']),
    progress: pickNumber(subject, ['progress']),
  }))

  return {
    course_name: pickString(root, ['course_name', 'course_title', 'title']),
    semester_name: pickString(root, ['semester_name']),
    total_xp: totalXp,
    current_level: pickNumber(root, ['current_level'], totalXp > 0 ? Math.floor(totalXp / 1000) : 0),
    rank: pickNumber(root, ['rank'], pickNumber(xp, ['overall_rank'])),
    total_students: pickNumber(root, ['total_students'], pickNumber(xp, ['student_count'])),
    lectures_attended: pickNumber(root, ['lectures_attended', 'total_lectures_attended'], pickNumber(performance, ['lectures_attended'])),
    total_lectures: pickNumber(root, ['total_lectures'], pickNumber(performance, ['total_lectures'])),
    assignments_completed: pickNumber(
      root,
      ['assignments_completed', 'total_completed_assignment_questions'],
      pickNumber(performance, ['completed_assignment_questions'])
    ),
    total_assignments: pickNumber(
      root,
      ['total_assignments'],
      pickNumber(performance, ['total_assignment_questions'])
    ),
    subjects,
  }
}

export function parseScheduleEvents(data: unknown): ScheduleEvent[] {
  const root = unwrapRecord(data)
  if (!root) return []

  const sources = [
    ...asRecordArray(root.upcoming_lectures),
    ...asRecordArray(root.upcoming_contests),
    ...asRecordArray(root.events),
    ...asRecordArray(root.schedule),
    ...asRecordArray(root.items),
  ]

  return sources.map((item) => ({
    id: stableId(item, ['hash', 'id', 'lecture_hash'], 'schedule'),
    title: pickString(item, ['title', 'lecture_title', 'name'], 'Untitled Event'),
    type: asScheduleType(pickString(item, ['type'], 'event')),
    subject_name: asString(item.subject_name ?? item.subject) || undefined,
    start_time: asString(item.start_timestamp ?? item.start_time ?? item.time),
    end_time: asString(item.end_timestamp ?? item.end_time),
    url: asString(item.url) || undefined,
  }))
}

function asScheduleType(value: string): ScheduleEvent['type'] {
  if (
    value === 'lecture' ||
    value === 'assessment' ||
    value === 'contest' ||
    value === 'assignment' ||
    value === 'event'
  ) {
    return value
  }
  return 'event'
}

export function parseLectures(data: unknown): Lecture[] {
  const root = unwrapRecord(data)
  const rawLectures = asRecordArray(root?.lectures ?? root?.data ?? (Array.isArray(parseToolText(data)) ? parseToolText(data) : []))

  return rawLectures.map((lecture) => {
    const startDate = coerceDate(lecture.start_timestamp ?? lecture.start_time)

    return {
      id: stableId(lecture, ['lecture_hash', 'hash', 'id'], 'lecture'),
      title: pickString(lecture, ['lecture_title', 'title'], 'Untitled Lecture'),
      subject: pickString(lecture, ['subject_name', 'subject']),
      subject_hash: asString(lecture.subject_hash) || undefined,
      instructor: pickString(asRecord(lecture.instructor_user), ['name'], pickString(lecture, ['instructor'])),
      date: (startDate ?? new Date()).toISOString().split('T')[0],
      start_time: toDisplayTime(lecture.start_timestamp ?? lecture.start_time),
      end_time: toDisplayTime(lecture.end_timestamp ?? lecture.end_time),
      status: coerceLectureStatus(lecture, startDate),
      recording_url: asString(lecture.recording_url ?? lecture.url) || undefined,
      description: pickString(lecture, ['description']),
      topics: pickArray(lecture, ['topics']).filter((topic): topic is string => typeof topic === 'string'),
      url: asString(lecture.url) || undefined,
    }
  })
}

export function parseAssignments(data: unknown): Assignment[] {
  const root = unwrapRecord(data)
  const rawAssignments = asRecordArray(root?.assignments ?? (Array.isArray(parseToolText(data)) ? parseToolText(data) : []))

  return rawAssignments.map((assignment) => {
    const dueDate = coerceDate(assignment.end_timestamp ?? assignment.due_date)

    return {
      id: stableId(assignment, ['assignment_hash', 'hash', 'id'], 'assignment'),
      title: pickString(assignment, ['assignment_title', 'title'], 'Untitled Assignment'),
      subject: pickString(assignment, ['subject_name', 'subject']),
      due_date: dueDate ? dueDate.toISOString() : toIsoDate(assignment.end_timestamp ?? assignment.due_date),
      status: coerceAssignmentStatus(assignment, dueDate),
      score: pickNumber(assignment, ['score', 'earned_points'], undefined),
      max_score: pickNumber(assignment, ['max_score', 'total_questions'], 100),
      description: pickString(
        assignment,
        ['description'],
        `${pickNumber(assignment, ['completed_questions'])}/${pickNumber(assignment, ['total_questions'])} questions completed`
      ),
      difficulty: coerceDifficulty(assignment.difficulty),
      url: asString(assignment.url) || undefined,
    }
  })
}

export function parseLeaderboard(data: unknown): LeaderboardEntry[] {
  const root = unwrapRecord(data)
  const rawEntries = asRecordArray(root?.leaderboard ?? root?.entries ?? (Array.isArray(parseToolText(data)) ? parseToolText(data) : []))

  return rawEntries.map((entry) => ({
    rank: pickNumber(entry, ['rank']),
    name: pickString(entry, ['name', 'student_name'], 'Student'),
    avatar_url: asString(entry.avatar_url) || undefined,
    xp: pickNumber(entry, ['xp', 'total_xp']),
    level: pickNumber(entry, ['level']),
    is_current_user: pickBoolean(entry, ['is_current_user']),
  }))
}

export function parseQotd(data: unknown): QOTD | null {
  const root = unwrapRecord(data)
  if (!root) return null

  const title = pickString(root, ['title', 'question'])
  if (!title) return null

  return {
    id: stableId(root, ['id', 'question_hash', 'hash'], 'qotd'),
    title,
    difficulty: coerceDifficulty(root.difficulty),
    category: asString(root.category ?? root.topic) || undefined,
    streak: pickNumber(root, ['streak']),
    completed_today: pickBoolean(root, ['completed_today', 'is_completed']),
    url: asString(root.url) || undefined,
  }
}

export interface ArenaTopicOption {
  label: string
  slug: string
}

export function parseArenaTopicOptions(data: unknown): ArenaTopicOption[] {
  const root = unwrapRecord(data)
  const topics = pickArray(root, ['topics', 'topic_filters'])

  return topics
    .map((topic) => {
      if (typeof topic === 'string') {
        return { label: topic, slug: topic }
      }

      const record = asRecord(topic)
      if (!record) return null

      const slug = pickString(record, ['slug', 'id', 'name', 'label'])
      const label = pickString(record, ['label', 'name', 'slug'], slug)
      if (!slug || !label) return null

      return { label, slug }
    })
    .filter((topic): topic is ArenaTopicOption => topic !== null)
}

export function parseArenaDifficultyOptions(data: unknown): Difficulty[] {
  const root = unwrapRecord(data)
  const difficulties = pickArray(root, ['difficulties', 'difficulty_filters'])
  if (difficulties.length === 0) return ['easy', 'medium', 'hard']

  const normalized = difficulties
    .map((difficulty) => {
      if (typeof difficulty === 'string') return coerceDifficulty(difficulty)
      const record = asRecord(difficulty)
      return coerceDifficulty(record?.slug ?? record?.name ?? record?.label)
    })
    .filter((difficulty, index, all) => all.indexOf(difficulty) === index)

  return normalized.length > 0 ? normalized : ['easy', 'medium', 'hard']
}

export { mapArenaProblem }
