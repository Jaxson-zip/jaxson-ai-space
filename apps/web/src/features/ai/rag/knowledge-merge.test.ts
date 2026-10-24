import { afterEach, describe, expect, it, vi } from 'vitest'

// A knowledge-base entry written about a published project or experience must not become a second,
// competing source for the same thing: the answer would cite both and repeat itself.
const { findMock, portfolio } = vi.hoisted(() => ({
  findMock: vi.fn(),
  portfolio: { projects: [] as unknown[], experiences: [] as unknown[], awards: [] as unknown[], skillGroups: [] as unknown[] },
}))

vi.mock('payload', () => ({ getPayload: async () => ({ find: findMock }) }))
vi.mock('@/payload.config', () => ({ default: Promise.resolve({}) }))
vi.mock('@/features/portfolio/data', () => ({ getHydratedPortfolioData: async () => portfolio }))

import { loadKnowledgeChunks } from './knowledge-loader'

const project = (slug: string, title: string, shortTitle: string) => ({
  slug, title, shortTitle, category: '应用', sourceVisibility: 'public', status: '已上线', summary: '简介',
  problem: `${shortTitle} 的背景`, approach: '做法', outcome: '结果', role: '独立开发', technologies: ['React'],
  image: null, links: [],
})
const entry = (id: number, title: string, category: string, content: string, evidenceTag = title) =>
  ({ id, title, category, content, evidenceTag, isPublic: true })

afterEach(() => {
  vi.clearAllMocks()
  portfolio.projects = []
  portfolio.experiences = []
})

describe('knowledge entries about a published record', () => {
  it('fold into that project or experience, so each is one source', async () => {
    portfolio.projects = [
      project('jaxson-ai-space', 'Jaxson AI Space (本站 · 全栈个人门户与 AI 分身)', 'Jaxson AI Space'),
      project('todo-memo', '待办备忘 (Todo Memo)', '待办备忘 (Todo Memo)'),
    ]
    portfolio.experiences = [{
      id: '1', organization: '广东润喵云科技有限公司', role: '开发实习生', period: '2026.06 - 2026.08',
      summary: '参与算力租赁平台迭代。', bullets: [], technologies: [], kind: 'internship',
    }]
    findMock.mockResolvedValue({ docs: [
      entry(1, 'Jaxson AI Space 核心项目', 'project', '补充：支持多轮对话记忆。'),
      entry(2, 'Todo Memo PWA 核心项目', 'project', '补充：可以安装到桌面。'),
      entry(3, '润喵云实习', 'internship', '补充：用 Vue 做管理端。', '广东润喵云科技 · 全栈开发实习生'),
      entry(4, '求职意向', 'intent', '希望在深圳做 AI 应用开发。'),
    ] })

    const chunks = await loadKnowledgeChunks('你做过哪些项目？')

    expect(chunks.map((chunk) => chunk.id).sort()).toEqual(['cms-4', 'exp-1', 'project-jaxson-ai-space', 'project-todo-memo'])
    const byId = Object.fromEntries(chunks.map((chunk) => [chunk.id, chunk]))
    expect(byId['project-jaxson-ai-space'].content).toContain('【补充资料】补充：支持多轮对话记忆。')
    expect(byId['project-todo-memo'].content).toContain('【补充资料】补充：可以安装到桌面。')
    expect(byId['exp-1'].content).toContain('【补充资料】补充：用 Vue 做管理端。')
    expect(byId['project-jaxson-ai-space'].evidenceTag).toBe('项目档案：Jaxson AI Space (本站 · 全栈个人门户与 AI 分身)')
  })

  it('stay on their own when they name several records or none', async () => {
    portfolio.projects = [
      project('jaxson-ai-space', 'Jaxson AI Space (本站)', 'Jaxson AI Space'),
      project('todo-memo', '待办备忘 (Todo Memo)', '待办备忘 (Todo Memo)'),
    ]
    findMock.mockResolvedValue({ docs: [
      entry(5, 'Jaxson AI Space 与 Todo Memo 的对比', 'project', '两个项目的取舍。'),
      entry(6, '技术选型思路', 'project', '为什么用 Payload。'),
    ] })

    const chunks = await loadKnowledgeChunks('对比一下两个项目')

    expect(chunks.map((chunk) => chunk.id)).toEqual(expect.arrayContaining(['cms-5', 'cms-6']))
    expect(chunks.find((chunk) => chunk.id === 'project-todo-memo')!.content).not.toContain('【补充资料】')
  })
})
