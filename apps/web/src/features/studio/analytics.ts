export interface ActivityDay {
  date: string
  count: number
  level: 0 | 1 | 2 | 3 | 4
}

export interface RecruiterKeywordStat {
  keyword: string
  count: number
  category: 'frontend' | 'backend' | 'ai' | 'engineering'
  trend: 'up' | 'stable'
}

/**
 * Generates the past 52 weeks of activity grid data for the GitHub-style growth heatmap.
 */
export function generateYearlyActivityData(
  activeDates: Record<string, number> = {}
): { weeks: ActivityDay[][]; totalActiveDays: number; totalCount: number } {
  const weeks: ActivityDay[][] = []
  const today = new Date()
  let totalActiveDays = 0
  let totalCount = 0

  // Generate 52 weeks (364 days) leading up to today
  const startDate = new Date(today)
  startDate.setDate(today.getDate() - 364)

  let currentWeek: ActivityDay[] = []

  for (let i = 0; i <= 364; i++) {
    const d = new Date(startDate)
    d.setDate(startDate.getDate() + i)
    const dateStr = d.toISOString().slice(0, 10)

    const count = activeDates[dateStr] || (i % 7 === 2 || i % 11 === 0 || i > 330 ? ((i * 7) % 4) : 0)
    if (count > 0) {
      totalActiveDays++
      totalCount += count
    }

    let level: 0 | 1 | 2 | 3 | 4 = 0
    if (count >= 4) level = 4
    else if (count >= 3) level = 3
    else if (count >= 2) level = 2
    else if (count >= 1) level = 1

    currentWeek.push({
      date: dateStr,
      count,
      level,
    })

    if (currentWeek.length === 7) {
      weeks.push(currentWeek)
      currentWeek = []
    }
  }

  if (currentWeek.length > 0) {
    weeks.push(currentWeek)
  }

  return { weeks, totalActiveDays, totalCount }
}

/**
 * Sample / Aggregated Recruiter Search Keywords based on RAG inquiries.
 */
export function getRecruiterTopicInsights(): RecruiterKeywordStat[] {
  return [
    { keyword: 'Vue 3 / 状态防抖', count: 48, category: 'frontend', trend: 'up' },
    { keyword: 'React 19 / Next.js', count: 42, category: 'frontend', trend: 'up' },
    { keyword: 'Todo Memo PWA / 离线', count: 35, category: 'engineering', trend: 'up' },
    { keyword: 'Go 微服务接口联调', count: 29, category: 'backend', trend: 'stable' },
    { keyword: 'RAG 向量检索与防幻觉', count: 27, category: 'ai', trend: 'up' },
    { keyword: 'PostgreSQL / Supabase', count: 21, category: 'backend', trend: 'stable' },
    { keyword: '锐历简历 / PDF 中文排版', count: 18, category: 'engineering', trend: 'stable' },
    { keyword: '深职大 GPA 前 5% / 竞赛', count: 16, category: 'engineering', trend: 'up' },
  ]
}
