import { useState, useEffect } from 'react'
import { invoke } from '@/lib/tauri'
import { parseToolText, mapArenaProblem } from '@/lib/newton-parsers'
import type { ArenaProblem } from '@/types/newton'

export interface ArenaFilters {
  query?: string
  difficulty?: string | null
  topics?: string | null
  companies?: string | null
}

export function useArenaSearch(filters: ArenaFilters) {
  const [problems, setProblems] = useState<ArenaProblem[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)

  useEffect(() => {
    let active = true

    const timer = setTimeout(async () => {
      if (!active) return
      setLoading(true)
      try {
        const result = await invoke<unknown>('mcp_call_tool', {
          serverId: 'newton-school',
          toolName: 'search_practice_questions',
          // Tauri command param name is `args` (snake_case mapped from camelCase)
          args: {
            ...(filters.query ? { query: filters.query } : {}),
            ...(filters.topics ? { topics: filters.topics } : {}),
            ...(filters.difficulty ? { difficulty: filters.difficulty } : {}),
            ...(filters.companies ? { companies: filters.companies } : {}),
            limit: 20,
          },
        })
        if (!active) return
        const data = parseToolText(result) as any
        const questions = data?.questions ?? []
        setProblems(questions.map(mapArenaProblem))
        setHasMore(data?.has_more ?? false)
      } catch {
        if (!active) return
        setProblems([])
        setHasMore(false)
      } finally {
        if (active) setLoading(false)
      }
    }, 300)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [filters.query, filters.difficulty, filters.topics, filters.companies])

  return { problems, loading, hasMore }
}
