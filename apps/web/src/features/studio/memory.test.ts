import { describe, expect, it } from 'vitest'
import { extractCandidateMemories, extractTagsFromText } from './memory-extractor'

describe('Memory Extractor & Tagging System', () => {
  it('extracts technical tags accurately from text', () => {
    const text = '在 Vue3 和 Go 微服务架构下，使用 PostgreSQL 与 Redis 解决了高并发状态同步问题'
    const tags = extractTagsFromText(text)
    expect(tags).toContain('Vue3')
    expect(tags).toContain('Go')
    expect(tags).toContain('PostgreSQL')
    expect(tags).toContain('微服务')
    expect(tags).toContain('高并发')
  })

  it('extracts structured candidate memories from a full reflection', () => {
    const memories = extractCandidateMemories({
      id: 'ref-001',
      title: '优化 Vue3 监控组件防抖与并发状态',
      type: 'daily',
      date: '2026-08-30',
      content: '今日跟进润喵云算力平台订单模块与资源监控页面。',
      challenges: '高频轮询接口导致前端渲染卡顿，且快速切换 Tab 存在竞态条件。',
      solution: '引入 useRequest 竞态取消机制与 300ms 动态防抖，内存占用降低 40%。',
      takeaways: '在复杂异步场景下，必须在组件卸载或前序请求未完成时主动 Abort。',
      nextSteps: '深入学习 pgvector 索引性能调优与 Cloudflare Access 鉴权规则。',
    })

    expect(memories.length).toBe(3)

    // 1. Solution highlight
    const solutionMem = memories.find((m) => m.category === 'pitfall_solution')
    expect(solutionMem).toBeDefined()
    expect(solutionMem?.title).toContain('技术攻坚')
    expect(solutionMem?.status).toBe('candidate')
    expect(solutionMem?.tags).toContain('Vue3')
    expect(solutionMem?.tags).toContain('防抖')
    expect(solutionMem?.evidenceTag).toContain('2026-08-30')

    // 2. Takeaways
    const takeawayMem = memories.find((m) => m.category === 'architecture_thinking')
    expect(takeawayMem).toBeDefined()
    expect(takeawayMem?.content).toContain('Abort')

    // 3. Next steps / skill gap
    const goalMem = memories.find((m) => m.category === 'skill_gap_goal')
    expect(goalMem).toBeDefined()
    expect(goalMem?.tags).toContain('pgvector')
    expect(goalMem?.tags).toContain('Cloudflare')
  })

  it('handles simple reflection without solution gracefully', () => {
    const memories = extractCandidateMemories({
      title: '学习 Next.js 16 缓存机制与 Server Actions',
      type: 'technical',
      date: '2026-08-30',
      content: '系统梳理了 Next.js App Router 中的 Fetch 缓存级别与 On-demand Revalidation。',
    })

    expect(memories.length).toBe(1)
    expect(memories[0].category).toBe('project_experience')
    expect(memories[0].tags).toContain('Next.js')
  })
})
