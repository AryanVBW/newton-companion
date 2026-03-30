import type {
  CourseOverview,
  Lecture,
  LectureStatus,
  Assignment,
  AssignmentStatus,
  LeaderboardEntry,
  QOTD,
  ScheduleItem,
  ArenaProblem,
  Difficulty,
} from '@/types/newton'

// ---------------------------------------------------------------------------
// MCP envelope unwrapper
// Cached data arrives as plain objects; direct mcp_call_tool results arrive
// wrapped in { content: [{ text: "..." }] }. This handles both.
// ---------------------------------------------------------------------------
export function parseToolText(data: unknown): unknown {
  try {
    if (!data) return null
    if (typeof data === 'object' && data !== null) {
      const envelope = data as any
      const text = envelope?.content?.[0]?.text
      if (typeof text === 'string') return JSON.parse(text)
    }
    return data
  } catch {
    return data
  }
}

// ---------------------------------------------------------------------------
// Course overview
// Real shape: { course_title, performance: { lectures_attended, total_lectures,
//   completed_assignment_questions, total_assignment_questions },
//   xp: { total_earned, overall_rank, student_count } }
// ---------------------------------------------------------------------------
export function mapCourseOverview(raw: any): CourseOverview {
  const xpEarned = raw.xp?.total_earned ?? 0
  return {
    course_name: raw.course_title ?? raw.course_name ?? '',
    semester_name: raw.semester_name ?? '',
    total_xp: xpEarned,
    current_level: Math.floor(xpEarned / 1000),
    rank: raw.xp?.overall_rank ?? raw.rank ?? 0,
    total_students: raw.xp?.student_count ?? raw.total_students ?? 0,
    lectures_attended: raw.performance?.lectures_attended ?? raw.lectures_attended ?? 0,
    total_lectures: raw.performance?.total_lectures ?? raw.total_lectures ?? 0,
    assignments_completed:
      raw.performance?.completed_assignment_questions ??
      raw.assignments_completed ?? 0,
    total_assignments:
      raw.performance?.total_assignment_questions ??
      raw.total_assignments ?? 0,
    subjects: raw.subjects ?? [],
  }
}

// ---------------------------------------------------------------------------
// Schedule
// Real shape: { upcoming_lectures: [{ hash, title, subject_name,
//   start_timestamp(ISO), end_timestamp(ISO), type, url }],
//   upcoming_contests: [...] }
// ---------------------------------------------------------------------------
export function parseSchedule(data: unknown): ScheduleItem[] {
  const raw = parseToolText(data) as any
  if (!raw) return []

  const lectures: ScheduleItem[] = (raw.upcoming_lectures ?? []).map((l: any) => ({
    id: l.hash ?? l.id ?? crypto.randomUUID(),
    title: l.title || l.subject_name || 'Lecture',
    subject: l.subject_name,
    time: l.start_timestamp,
    end_time: l.end_timestamp,
    type: 'lecture' as const,
    url: l.url,
  }))

  const contests: ScheduleItem[] = (raw.upcoming_contests ?? []).map((c: any) => ({
    id: c.hash ?? c.id ?? crypto.randomUUID(),
    title: c.title || 'Contest',
    subject: c.subject_name,
    time: c.start_timestamp,
    end_time: c.end_timestamp,
    type: 'event' as const,
    url: c.url,
  }))

  return [...lectures, ...contests].sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
  )
}

// ---------------------------------------------------------------------------
// Lectures
// Real shape (get_recent_lectures): { lectures: [{ lecture_hash, title,
//   instructor, subject_name, subject_hash, is_attended, has_recording,
//   start_timestamp(ISO), end_timestamp(ISO), url }], returned_count }
// ---------------------------------------------------------------------------
export function mapLecture(raw: any): Lecture {
  const start = new Date(raw.start_timestamp)
  const now = new Date()
  let status: LectureStatus = 'upcoming'
  if (raw.is_attended || raw.attended) status = 'attended'
  else if (start > now) status = 'upcoming'
  else if (raw.has_recording) status = 'recording'
  else status = 'missed'

  return {
    id: raw.lecture_hash ?? raw.hash ?? raw.id ?? '',
    title: raw.title ?? raw.lecture_title ?? '',
    subject: raw.subject_name ?? raw.subject ?? '',
    subject_hash: raw.subject_hash,
    instructor: raw.instructor ?? raw.instructor_user?.name ?? '',
    date: start.toISOString().split('T')[0],
    start_time: start.toISOString(),
    end_time: raw.end_timestamp ?? '',
    status,
    recording_url: raw.url,
    description: raw.description ?? '',
    topics: raw.topics ?? [],
    url: raw.url,
  }
}

export function parseLectures(data: unknown): Lecture[] {
  const raw = parseToolText(data) as any
  if (!raw) return []
  const arr = raw?.lectures ?? raw
  return Array.isArray(arr) ? arr.map(mapLecture) : []
}

// ---------------------------------------------------------------------------
// Assignments
// Real shape (get_assignments): { assignments: [{ hash, title, subject_name,
//   end_timestamp(unix ms), total_questions, url }], contests: [...] }
// ---------------------------------------------------------------------------
export function mapAssignment(raw: any): Assignment {
  // end_timestamp can be unix ms (number) or ISO string
  const dueDate =
    typeof raw.end_timestamp === 'number'
      ? new Date(raw.end_timestamp)
      : new Date(raw.end_timestamp ?? raw.due_date ?? Date.now())
  const now = new Date()
  const derivedStatus: AssignmentStatus = dueDate < now ? 'overdue' : 'pending'

  return {
    id: raw.hash ?? raw.id ?? raw.assignment_hash ?? '',
    title: raw.title ?? raw.assignment_title ?? '',
    subject: raw.subject_name ?? raw.subject ?? '',
    due_date: dueDate.toISOString(),
    status: raw.status ?? derivedStatus,
    score: raw.earned_points ?? raw.score,
    max_score: raw.total_questions ?? raw.max_score ?? 100,
    description: raw.description ?? `${raw.total_questions ?? 0} questions`,
    difficulty: (raw.difficulty as Difficulty) ?? 'medium',
    url: raw.url,
  }
}

export function parseAssignments(data: unknown): Assignment[] {
  const raw = parseToolText(data) as any
  if (!raw) return []
  const arr = raw?.assignments ?? raw
  return Array.isArray(arr) ? arr.map(mapAssignment) : []
}

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------
export function mapLeaderboardEntry(raw: any): LeaderboardEntry {
  return {
    rank: raw.rank ?? 0,
    name: raw.name ?? raw.student_name ?? '',
    avatar_url: raw.avatar_url,
    xp: raw.xp ?? raw.total_xp ?? 0,
    level: raw.level ?? 0,
    is_current_user: raw.is_current_user ?? false,
  }
}

export function parseLeaderboard(data: unknown): LeaderboardEntry[] {
  const raw = parseToolText(data) as any
  if (!raw) return []
  const arr = raw?.leaderboard ?? raw
  return Array.isArray(arr) ? arr.map(mapLeaderboardEntry) : []
}

// ---------------------------------------------------------------------------
// QOTD (Question of the Day)
// ---------------------------------------------------------------------------
export function mapQotd(raw: any): QOTD {
  return {
    id: raw.id ?? raw.question_hash ?? '',
    title: raw.title ?? raw.question ?? '',
    difficulty: (raw.difficulty as Difficulty) ?? 'medium',
    category: raw.category ?? raw.topic ?? '',
    streak: raw.streak ?? 0,
    completed_today: raw.completed_today ?? raw.is_completed ?? false,
  }
}

// ---------------------------------------------------------------------------
// Arena problems (search_practice_questions)
// Real shape: { questions: [{ hash/id, title, difficulty, topic/category,
//   tags, is_solved, acceptance_rate, url }], total_count, has_more }
// ---------------------------------------------------------------------------
export function mapArenaProblem(raw: any): ArenaProblem {
  return {
    id: raw.hash ?? raw.id ?? '',
    title: raw.title ?? '',
    difficulty: ((raw.difficulty ?? 'medium') as string).toLowerCase() as Difficulty,
    category: raw.topic ?? raw.category ?? '',
    tags: raw.tags ?? [],
    solved: raw.is_solved ?? raw.solved ?? false,
    acceptance_rate: raw.acceptance_rate ?? 0,
    description: raw.description ?? '',
    url: raw.url,
  }
}
