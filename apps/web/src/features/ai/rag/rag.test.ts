import { describe, expect, it } from 'vitest'
import { cosineSimilarity, hybridRetrieve } from './retriever'
import { generateLocalEmbedding } from './embedder'
import { buildSystemPrompt } from './prompt-builder'
import type { KnowledgeChunk } from './types'

const MOCK_CHUNKS: KnowledgeChunk[] = [
  {
    id: 'exp-runmiaoyun',
    title: '经历：广东润喵云科技有限公司（前端开发与接口联调）',
    category: 'internship',
    content: '参与基于 Vue 3 + Go 算力租赁平台的前端开发与接口联调，负责订单中心与资源监控看板组件开发。',
    evidenceTag: '广东润喵云科技有限公司实习证明',
    keywords: ['润喵云', '实习', 'Vue 3', 'Go', '算力平台', '订单中心'],
  },
  {
    id: 'project-todo-memo',
    title: '项目：待办备忘 (Todo Memo)',
    category: 'project',
    content: '基于 React + TypeScript + Supabase + PWA 构建并部署至 Vercel，覆盖登录鉴权、任务多级分组与离线运行。',
    evidenceTag: 'Todo Memo PWA 源码与线上 Demo',
    keywords: ['Todo Memo', '待办备忘', 'React', 'TypeScript', 'Supabase', 'PWA'],
  },
  {
    id: 'profile-szpu',
    title: '教育与求职意向：深圳职业技术大学',
    category: 'education',
    content: '深圳职业技术大学大数据技术专业 2027 届（GPA 3.67/4.0 专业前 5%），期望岗位为全栈与 AI 应用开发。',
    evidenceTag: '张锦鹏在校成绩单与基本信息',
    keywords: ['深职大', '深圳职业技术大学', 'GPA', '大数据', '张锦鹏', '联系方式'],
  },
]

describe('RAG Engine & Hybrid Retriever', () => {
  it('computes exact cosine similarity for identical and orthogonal vectors', () => {
    const vecA = [1, 0, 0, 0]
    const vecB = [1, 0, 0, 0]
    const vecC = [0, 1, 0, 0]

    expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(1.0, 5)
    expect(cosineSimilarity(vecA, vecC)).toBeCloseTo(0.0, 5)
  })

  it('generates consistent normalized vector embeddings', () => {
    const vec = generateLocalEmbedding('Vue 3 Go 算力平台')
    expect(vec.length).toBe(64)
    const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0))
    expect(norm).toBeCloseTo(1.0, 3)
  })

  it('accurately matches Runmiaoyun internship query', () => {
    const results = hybridRetrieve('请介绍一下在润喵云的实习经历和产出', MOCK_CHUNKS, 1)
    expect(results).toHaveLength(1)
    expect(results[0].chunk.id).toBe('exp-runmiaoyun')
    expect(results[0].score).toBeGreaterThan(0.3)
  })

  it('accurately matches Todo Memo PWA project query', () => {
    const results = hybridRetrieve('Todo Memo PWA 离线运行和 Supabase 架构', MOCK_CHUNKS, 1)
    expect(results).toHaveLength(1)
    expect(results[0].chunk.id).toBe('project-todo-memo')
  })

  it('accurately matches GPA and education background query', () => {
    const results = hybridRetrieve('你在深职大的专业和 GPA 成绩是多少', MOCK_CHUNKS, 1)
    expect(results).toHaveLength(1)
    expect(results[0].chunk.id).toBe('profile-szpu')
  })

  it('preserves a pgvector score supplied by the database', () => {
    const results = hybridRetrieve(
      '完全不相关的问题',
      [
        { ...MOCK_CHUNKS[0], vectorScore: 0.99 },
        { ...MOCK_CHUNKS[1], vectorScore: 0.01 },
      ],
      1
    )

    expect(results[0].chunk.id).toBe('exp-runmiaoyun')
    expect(results[0].vectorScore).toBe(0.99)
  })

  it('builds a strict system prompt containing evidence tags and anti-hallucination guardrails', () => {
    const results = hybridRetrieve('润喵云实习', MOCK_CHUNKS, 1)
    const prompt = buildSystemPrompt(results, false)

    expect(prompt).toContain('张锦鹏')
    expect(prompt).toContain('真实检索事实')
    expect(prompt).toContain('广东润喵云科技有限公司实习证明')
  })

  it('builds a dedicated JD matching system prompt when isJdMatch is true', () => {
    const results = hybridRetrieve('前端开发工程师 React Vue 岗位需求', MOCK_CHUNKS, 2)
    const prompt = buildSystemPrompt(results, true)

    expect(prompt).toContain('张锦鹏（Jaxson）本人的 AI 数字分身')
    expect(prompt).toContain('第一人称“我”')
    expect(prompt).toContain('岗位契合度分析')
  })
})
