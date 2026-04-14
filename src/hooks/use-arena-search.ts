import { useState, useEffect } from 'react'
import { callNewtonTool } from '@/stores/newton-data-store'
import { parseToolText, mapArenaProblem } from '@/lib/parse-tool-text'
import type { ArenaProblem } from '@/types/newton'

export interface ArenaSearchFilters {
  query?: string
  difficulty?: string | null
  topic?: string | null
}

export function useArenaSearch(filters: ArenaSearchFilters) {
  const [problems, setProblems] = useState<ArenaProblem[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)

  useEffect(() => {
    let active = true

    // Debounce search by 350ms
    const timer = setTimeout(async () => {
      if (!active) return
      setLoading(true)
      try {
        const args: Record<string, unknown> = { limit: 30 }
        if (filters.query) args.query = filters.query
        if (filters.topic) args.topics = filters.topic
        if (filters.difficulty) args.difficulty = filters.difficulty

        const result = await callNewtonTool('search_practice_questions', args)
        if (!active) return

        const data = parseToolText(result)
        const record =
          typeof data === 'object' && data !== null
            ? (data as { questions?: unknown; has_more?: unknown })
            : null
        const questions = Array.isArray(record?.questions) ? record.questions : []

        setProblems(questions.map(mapArenaProblem))
        setHasMore(record?.has_more === true)
      } catch {
        if (!active) return
        setProblems([])
        setHasMore(false)
      } finally {
        if (active) setLoading(false)
      }
    }, 350)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [filters.query, filters.difficulty, filters.topic])

  return { problems, loading, hasMore }
}
