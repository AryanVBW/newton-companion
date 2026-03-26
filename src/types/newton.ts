export interface CourseListItem {
  course_hash: string
  course_name: string
  semester_name: string | null
  is_primary: boolean
  is_ongoing_semester: boolean
  subjects: SubjectListItem[]
}

export interface SubjectListItem {
  name: string
  subject_hash: string
}

export interface NewtonUser {
  name: string
  email: string
  avatar_url?: string
}

export interface CourseOverview {
  course_name: string
  semester_name: string
  total_xp: number
  current_level: number
  rank: number
  total_students: number
  lectures_attended: number
  total_lectures: number
  assignments_completed: number
  total_assignments: number
  subjects: SubjectProgress[]
}

export interface SubjectProgress {
  name: string
  progress: number
}

export interface Lecture {
  id: string
  title: string
  subject: string
  instructor: string
  date: string
  start_time: string
  end_time: string
  status: LectureStatus
  recording_url?: string
  description?: string
  topics: string[]
}

export type LectureStatus = 'attended' | 'missed' | 'upcoming' | 'recording'

export interface Assignment {
  id: string
  title: string
  subject: string
  due_date: string
  status: AssignmentStatus
  score?: number
  max_score: number
  description: string
  difficulty: Difficulty
}

export type AssignmentStatus = 'pending' | 'submitted' | 'graded' | 'overdue'

export interface ArenaProblem {
  id: string
  title: string
  difficulty: Difficulty
  category: string
  tags: string[]
  solved: boolean
  acceptance_rate: number
  description: string
}

export type Difficulty = 'easy' | 'medium' | 'hard'

export interface LeaderboardEntry {
  rank: number
  name: string
  avatar_url?: string
  xp: number
  level: number
  is_current_user: boolean
}

export interface ScheduleItem {
  id: string
  title: string
  time: string
  type: 'lecture' | 'assignment' | 'event'
  subject?: string
  status?: string
}

export interface QOTD {
  id: string
  title: string
  difficulty: Difficulty
  category: string
  streak: number
  completed_today: boolean
}

export interface QuickStats {
  lectures_percentage: number
  assignments_done: number
  total_assignments: number
  problems_solved: number
  current_rank: number
}
