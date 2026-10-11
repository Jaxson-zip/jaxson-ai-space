import { describe, expect, it } from 'vitest'
import { generateYearlyActivityData, getRecruiterTopicInsights } from './analytics'

describe('real private dashboard metrics', () => {
  it('retains a full yearly grid and counts only supplied records', () => {
    const today = new Date().toISOString().slice(0, 10)
    const previous = new Date()
    previous.setDate(previous.getDate() - 1)
    const grid = generateYearlyActivityData({ [today]: 3, [previous.toISOString().slice(0, 10)]: 2 })
    expect(grid.weeks.length).toBeGreaterThanOrEqual(52)
    expect(grid.weeks[0]).toHaveLength(7)
    expect(grid.weeks[0][0]).toHaveProperty('date')
    expect(grid.totalCount).toBe(5)
    expect(grid.totalActiveDays).toBe(2)
    expect(grid.weeks.flat().find((day) => day.date === today)).toMatchObject({ count: 3, level: 3 })
  })
  it('does not invent activity or recruiter queries for an empty workspace', () => {
    const grid = generateYearlyActivityData()
    expect(grid.totalCount).toBe(0)
    expect(grid.totalActiveDays).toBe(0)
    expect(getRecruiterTopicInsights()).toEqual([])
  })
})
