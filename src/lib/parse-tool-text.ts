import type { ArenaProblem, Difficulty } from '@/types/newton'

type JsonRecord = Record<string, unknown>

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === 'object' && value !== null
    ? (value as JsonRecord)
    : null
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/**
 * Parse MCP tool response — handles both:
 *  - Raw MCP envelope: { content: [{ text: "..." }] }
 *  - Pre-parsed plain objects (from SQLite cache)
 */
export function parseToolText(data: unknown): unknown {
  try {
    if (!data) return null

    const record = asRecord(data)
    if (!record) return data

    const content = Array.isArray(record.content) ? record.content : null
    const firstItem = content && content.length > 0 ? asRecord(content[0]) : null
    const text = asString(firstItem?.text)

    if (text) return JSON.parse(text)

    return data
  } catch {
    return data
  }
}

/** Map a raw Newton MCP question object to our ArenaProblem type. */
export function mapArenaProblem(raw: unknown): ArenaProblem {
  const record = asRecord(raw)
  const difficulty: Difficulty =
    typeof record?.difficulty === 'string'
      ? (record.difficulty.toLowerCase() as Difficulty)
      : 'medium'

  return {
    id: asString(record?.hash ?? record?.id),
    title: asString(record?.title),
    difficulty,
    category: asString(record?.topic ?? record?.category),
    tags: Array.isArray(record?.tags)
      ? record.tags.filter((tag): tag is string => typeof tag === 'string')
      : [],
    solved: typeof record?.is_solved === 'boolean'
      ? record.is_solved
      : record?.solved === true,
    acceptance_rate:
      typeof record?.acceptance_rate === 'number'
        ? record.acceptance_rate
        : 0,
    description: asString(record?.description),
    url: asString(record?.url) || undefined,
  }
}
