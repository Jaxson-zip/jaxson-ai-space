export interface MemorySections {
  scenario: string
  solution: string
}

const scenarioHeadings = new Set(['业务场景', '难点与场景', '场景与难点', '遇到难点', '业务难点与场景'])
const solutionHeadings = new Set(['攻坚突破', '技术方案', '架构决策', '解决方案', '技术实现', '技术方案与实现', '解决手段与架构'])

/** Only offer two-field editing when it can represent every section of the original text. */
export function parseMemorySections(content: string): MemorySections | null {
  const headings = [...content.matchAll(/【([^】\r\n]+)】/g)]
  if (!headings.length || content.slice(0, headings[0].index).trim()) return null
  const sections: MemorySections = { scenario: '', solution: '' }
  const seen = new Set<keyof MemorySections>()
  for (const [index, heading] of headings.entries()) {
    const key = scenarioHeadings.has(heading[1]) ? 'scenario' : solutionHeadings.has(heading[1]) ? 'solution' : null
    if (!key || seen.has(key)) return null
    seen.add(key)
    sections[key] = content.slice(heading.index + heading[0].length, headings[index + 1]?.index).trim()
  }
  return sections
}

export function serializeMemorySections(original: string, sections: MemorySections): string {
  const parsed = parseMemorySections(original)
  if (!parsed || (parsed.scenario === sections.scenario && parsed.solution === sections.solution)) return original
  return [
    sections.scenario.trim() ? `【业务难点与场景】${sections.scenario.trim()}` : '',
    sections.solution.trim() ? `【技术方案与实现】${sections.solution.trim()}` : '',
  ].filter(Boolean).join('\n')
}
