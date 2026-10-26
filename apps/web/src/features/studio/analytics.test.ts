import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateYearlyActivityData, getRecruiterTopicInsights } from './analytics'
import { localDate } from './local-date'

afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })

describe('real private dashboard metrics', () => {
  it('retains a full yearly grid and counts only supplied records', () => {
    const today = localDate()
    const previous = new Date()
    previous.setDate(previous.getDate() - 1)
    const grid = generateYearlyActivityData({ [today]: 3, [localDate(previous)]: 2 })
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
  it('ends the heatmap on the same local day as the reflection form', () => {
    vi.stubEnv('TZ', 'America/Los_Angeles')
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-25T00:30:00Z'))
    const grid = generateYearlyActivityData({ '2026-10-24': 2 })
    expect(grid.weeks.flat().at(-1)).toMatchObject({ date: '2026-10-24', count: 2 })
  })
})
