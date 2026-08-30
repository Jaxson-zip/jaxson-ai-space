import { describe, it, expect } from 'vitest'
import { parseRawMessageToReflection } from './inbox-parser'
import { extractCandidateMemories } from './memory-extractor'

describe('Studio Inbox Parser & Candidate Extractor', () => {
  it('parses informal WeChat message with explicit fp prefix', () => {
    const raw = 'fp 优化了 Vue3 监控大屏防抖，解决了高并发下的状态抖动'
    const reflection = parseRawMessageToReflection(raw)

    expect(reflection.type).toBe('technical')
    expect(reflection.content).toContain('优化了 Vue3 监控大屏防抖')
    expect(reflection.solution).toContain('解决了高并发下的状态抖动')

    const candidates = extractCandidateMemories(reflection)
    expect(candidates.length).toBeGreaterThan(0)
    expect(candidates[0].tags).toContain('Vue3')
    expect(candidates[0].status).toBe('candidate')
  })

  it('parses natural language message without prefix containing challenges and solutions', () => {
    const raw = '今天在润喵云调接口遇到了跨域和并发抖动，最后用防抖和状态锁搞定了'
    const reflection = parseRawMessageToReflection(raw)

    expect(reflection.type).toBe('technical')
    expect(reflection.challenges).toContain('遇到了跨域和并发抖动')
    expect(reflection.solution).toContain('最后用防抖和状态锁搞定了')

    const candidates = extractCandidateMemories(reflection)
    expect(candidates.length).toBeGreaterThan(0)
    expect(candidates[0].category).toBe('pitfall_solution')
    expect(candidates[0].content).toContain('防抖')
  })

  it('handles general reflections gracefully', () => {
    const raw = '今天梳理了 2026 年秋招目标，打算本周把 Next.js 全栈项目上线并写好简历'
    const reflection = parseRawMessageToReflection(raw)

    expect(reflection.type).toBe('daily')
    const candidates = extractCandidateMemories(reflection)
    expect(candidates.length).toBeGreaterThan(0)
    expect(candidates[0].tags).toContain('Next.js')
  })
})
