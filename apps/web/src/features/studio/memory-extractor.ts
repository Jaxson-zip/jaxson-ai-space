export interface ReflectionInput {
  id?: string
  title: string
  type: 'daily' | 'weekly' | 'interview' | 'technical'
  date: string
  content: string
  challenges?: string
  solution?: string
  takeaways?: string
  nextSteps?: string
}

export interface CandidateMemory {
  id?: string
  title: string
  category:
    | 'project_experience'
    | 'internship_business'
    | 'architecture_thinking'
    | 'pitfall_solution'
    | 'skill_gap_goal'
  status: 'candidate' | 'approved' | 'archived'
  content: string
  evidenceTag: string
  confidence: number
  sourceReflectionId?: string
  tags: string[]
}

const TECH_KEYWORDS = [
  'React',
  'Next.js',
  'Vue',
  'Vue3',
  'TypeScript',
  'JavaScript',
  'Go',
  'Golang',
  'Python',
  'Node.js',
  'PostgreSQL',
  'Postgres',
  'SQLite',
  'pgvector',
  'Payload CMS',
  'Docker',
  'Caddy',
  'Cloudflare',
  'Supabase',
  'PWA',
  'RAG',
  'Embedding',
  'DeepSeek',
  'OpenAI',
  'Tailwind',
  'CSS',
  'SSE',
  '微服务',
  '高并发',
  '防抖',
  '节流',
  '竞态',
  '状态管理',
  '鉴权',
  '缓存',
]

/**
 * Extract technology and skill tags from free-form text.
 */
export function extractTagsFromText(text: string): string[] {
  const matched = new Set<string>()
  const lower = text.toLowerCase()

  for (const kw of TECH_KEYWORDS) {
    if (lower.includes(kw.toLowerCase())) {
      matched.add(kw)
    }
  }

  return Array.from(matched)
}

/**
 * Deterministic, intelligent candidate memory extractor.
 * Converts unstructured daily/weekly reflection into structured, verifiable candidate memories.
 */
export function extractCandidateMemories(reflection: ReflectionInput): CandidateMemory[] {
  const results: CandidateMemory[] = []
  const baseTag = `复盘记录 · ${reflection.date}`
  const combinedText = [
    reflection.content,
    reflection.challenges || '',
    reflection.solution || '',
    reflection.takeaways || '',
  ].join(' ')

  const allTags = extractTagsFromText(combinedText)

  // 1. Extract Project / Technical Highlights & Solutions
  if (reflection.solution && reflection.solution.trim().length > 10) {
    const title = reflection.challenges
      ? `技术攻坚：${reflection.title} (难点解决)`
      : `核心产出：${reflection.title}`

    const tags = extractTagsFromText(`${reflection.title} ${reflection.solution} ${reflection.challenges || ''}`)

    results.push({
      title,
      category: reflection.challenges ? 'pitfall_solution' : 'project_experience',
      status: 'candidate',
      content: `【难点与场景】${reflection.challenges || reflection.content}\n【解决手段与架构】${reflection.solution}`,
      evidenceTag: `${baseTag} · 攻坚方案`,
      confidence: 0.96,
      sourceReflectionId: reflection.id,
      tags: tags.length > 0 ? tags : allTags.slice(0, 4),
    })
  } else if (reflection.content && reflection.content.trim().length > 15) {
    // If no dedicated solution field, extract from main content
    results.push({
      title: `工作实践：${reflection.title}`,
      category: reflection.type === 'interview' ? 'internship_business' : 'project_experience',
      status: 'candidate',
      content: reflection.content.trim(),
      evidenceTag: `${baseTag} · 工作纪实`,
      confidence: 0.92,
      sourceReflectionId: reflection.id,
      tags: allTags.slice(0, 4),
    })
  }

  // 2. Extract Cognitive Insights / Architectural Takeaways
  if (reflection.takeaways && reflection.takeaways.trim().length > 8) {
    const takeawayTags = extractTagsFromText(reflection.takeaways)
    results.push({
      title: `认知与方法论：${reflection.title}`,
      category: 'architecture_thinking',
      status: 'candidate',
      content: reflection.takeaways.trim(),
      evidenceTag: `${baseTag} · 经验总结`,
      confidence: 0.94,
      sourceReflectionId: reflection.id,
      tags: takeawayTags.length > 0 ? takeawayTags : ['架构思维', '方法论'],
    })
  }

  // 3. Extract Skill Gaps & Action Items (if marked in nextSteps)
  if (reflection.nextSteps && reflection.nextSteps.trim().length > 8) {
    const nextStepTags = extractTagsFromText(reflection.nextSteps)
    results.push({
      title: `成长与待跟进目标：${reflection.title}`,
      category: 'skill_gap_goal',
      status: 'candidate',
      content: reflection.nextSteps.trim(),
      evidenceTag: `${baseTag} · 跟进项`,
      confidence: 0.90,
      sourceReflectionId: reflection.id,
      tags: nextStepTags.length > 0 ? nextStepTags : ['成长目标', '秋招准备'],
    })
  }

  return results
}
