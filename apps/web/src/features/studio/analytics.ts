import { localDate } from './local-date'

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
    const dateStr = localDate(d)

    const count = activeDates[dateStr] || 0
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
 * Recruiter analytics is not connected yet; return no observations.
 */
export function getRecruiterTopicInsights(): RecruiterKeywordStat[] {
  // No recruiter analytics backend is connected. Do not substitute sample counts.
  return []
}
