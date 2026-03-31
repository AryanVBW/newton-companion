/**
 * Parse MCP tool response — handles both:
 *  - Raw MCP envelope: { content: [{ text: "..." }] }
 *  - Pre-parsed plain objects (from SQLite cache)
 */
export function parseToolText(data: any): any {
  try {
    if (!data) return null
    if (typeof data === 'object' && !data?.content?.[0]?.text) return data
    const text = data?.content?.[0]?.text
    if (text) return JSON.parse(text)
    return data
  } catch {
    return data
  }
}
