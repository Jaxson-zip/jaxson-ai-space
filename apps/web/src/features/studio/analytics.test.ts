import { describe, it, expect } from 'vitest'
import { generateYearlyActivityData, getRecruiterTopicInsights } from './analytics'

describe('Studio Growth Heatmap & Analytics Engine', () => {
  it('generates 52 weeks of activity grid data correctly', () => {
    const activeDates = {
      '2026-08-30': 3,
      '2026-08-29': 2,
      '2026-08-28': 1,
    }

    const { weeks, totalActiveDays, totalCount } = generateYearlyActivityData(activeDates)

    expect(weeks.length).toBeGreaterThanOrEqual(52)
    expect(totalActiveDays).toBeGreaterThan(0)
    expect(totalCount).toBeGreaterThan(0)

    // Verify cell structures
    const firstWeek = weeks[0]
    expect(firstWeek.length).toBe(7)
    expect(firstWeek[0]).toHaveProperty('date')
    expect(firstWeek[0]).toHaveProperty('count')
    expect(firstWeek[0]).toHaveProperty('level')
  })

  it('provides recruiter inquiry insights with valid keyword categories and counts', () => {
    const insights = getRecruiterTopicInsights()

    expect(insights.length).toBeGreaterThan(0)
    expect(insights[0]).toHaveProperty('keyword')
    expect(insights[0]).toHaveProperty('count')
    expect(insights[0]).toHaveProperty('category')

    const vueInsight = insights.find((i) => i.keyword.includes('Vue 3'))
    expect(vueInsight).toBeDefined()
    expect(vueInsight?.count).toBeGreaterThan(0)
  })
})
