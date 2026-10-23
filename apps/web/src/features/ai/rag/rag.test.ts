import { describe, expect, it, vi } from 'vitest'
import { cosineSimilarity, groundedRetrieve, hybridRetrieve } from './retriever'
import { generateLocalEmbedding, fetchSemanticEmbedding } from './embedder'
import { buildSystemPrompt } from './prompt-builder'
import { buildLocalRAGAnswer, createRAGStream } from './llm-stream'
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
    content: '深圳职业技术大学大数据技术专业 2027 届（GPA 3.85/4.0，专业前 2%），期望岗位为全栈与 AI 应用开发。',
    evidenceTag: '张锦鹏在校成绩单与基本信息',
    keywords: ['深职大', '深圳职业技术大学', 'GPA', '大数据', '张锦鹏', '联系方式'],
  },
]

describe('RAG Engine & Hybrid Retriever', () => {
  it('accepts a strong validated semantic match while rejecting hash similarity without keyword evidence', () => {
    const chunk: KnowledgeChunk = { id: 'semantic-fact', title: 'Portable tasks', category: 'project', content: 'Offline task application', evidenceTag: 'CMS', keywords: [], vectorScore: 0.95, vectorSource: 'semantic' }
    expect(groundedRetrieve('多设备待办', [chunk])).toHaveLength(1)
    expect(groundedRetrieve('多设备待办', [{ ...chunk, vectorSource: 'local' }])).toHaveLength(0)
  })

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

  it('does not use a hash collision as evidence for an unrecorded topic', () => {
    expect(groundedRetrieve('量子计算经验', MOCK_CHUNKS)).toEqual([])
    const relatedButNotRelevant = {
      ...MOCK_CHUNKS[2],
      content: '主修分布式计算课程。',
    }
    expect(groundedRetrieve('量子计算经验', [relatedButNotRelevant])).toEqual([])
  })

  it('answers basic experience questions whose wording shares only the topic word with the record', () => {
    const award: KnowledgeChunk = {
      id: 'awards-summary',
      title: '竞赛荣誉与学业奖项',
      category: 'award',
      content: '- 中国大学生计算机设计大赛（国家级二等奖，2024 — 2025）',
      evidenceTag: 'CMS 竞赛与学业奖项',
      keywords: ['竞赛', '荣誉', '奖项'],
    }
    const chunks = [...MOCK_CHUNKS, award]

    const internship = groundedRetrieve('你现在在哪里实习？', chunks)
    expect(internship.map((result) => result.chunk.id)).toEqual(['exp-runmiaoyun'])
    expect(groundedRetrieve('你在哪所学校读书？', chunks).map((result) => result.chunk.id)).toContain('profile-szpu')
    expect(groundedRetrieve('你拿过什么奖吗？', chunks).map((result) => result.chunk.id)).toContain('awards-summary')
  })

  it('does not let a topic word pull in records from an unasked category', () => {
    expect(groundedRetrieve('量子计算实习经验', [MOCK_CHUNKS[1]])).toEqual([])
  })

  it('finds all published project facts for a general project-list question', () => {
    const secondProject: KnowledgeChunk = {
      ...MOCK_CHUNKS[1],
      id: 'project-resume',
      title: '项目：锐历简历工作台',
      content: '中文简历模板排版和 PDF 导出。',
      keywords: ['锐历简历', '中文简历'],
    }

    const results = groundedRetrieve('你有哪些项目？', [...MOCK_CHUNKS, secondProject])

    expect(results.map((result) => result.chunk.id)).toEqual(
      expect.arrayContaining(['project-todo-memo', 'project-resume']),
    )
    expect(results.every((result) => result.chunk.category === 'project')).toBe(true)
  })

  it('lists projects in the order the home page shows them, not by retrieval score', () => {
    const project = (id: string, title: string, featured = false): KnowledgeChunk => ({
      ...MOCK_CHUNKS[1], id, title: `项目：${title}`, content: `${title} 的项目档案。`, keywords: [title], featured,
    })
    // Loader order is the home page order: featured first, then the owner's sort order.
    const chunks = [project('p-b', '乙', true), project('p-c', '丙', true), project('p-a', '甲 项目 做过 哪些')]
    const results = groundedRetrieve('你做过哪些项目？', chunks)
    expect(results.map((result) => result.chunk.id)).toEqual(['p-b', 'p-c', 'p-a'])
  })

  it('answers "best work" questions with the featured projects', () => {
    const project = (id: string, featured = false): KnowledgeChunk => ({
      ...MOCK_CHUNKS[1], id, title: `项目：${id}`, content: `${id} 的项目档案。`, keywords: [id], featured,
    })
    const chunks = [project('p-star', true), project('p-plain'), ...MOCK_CHUNKS]
    for (const question of ['你最有代表性的项目是什么？', '你最拿得出手的作品是哪个？']) {
      expect(groundedRetrieve(question, chunks).map((result) => result.chunk.id), question).toEqual(['p-star'])
    }
  })

  it('lists multiple retrieved live projects without adding canned claims', () => {
    const projects: KnowledgeChunk[] = [
      { ...MOCK_CHUNKS[1], content: '【交付结果】支持离线任务。\n【状态】已上线' },
      { ...MOCK_CHUNKS[1], id: 'portfolio', title: '项目：个人作品集网站', content: '【交付结果】作品站点可访问。\n【状态】已上线' },
      { ...MOCK_CHUNKS[1], id: 'draft', title: '项目：尚未上线的原型', content: '【状态】项目经历' },
    ]
    const results = projects.map((chunk) => ({ chunk, score: 0.8, vectorScore: 0.8, bm25Score: 0.8 }))
    const answer = buildLocalRAGAnswer('你有哪些已经上线的项目？', results)

    expect(answer).toContain('待办备忘 (Todo Memo)')
    expect(answer).toContain('个人作品集网站')
    expect(answer).not.toContain('尚未上线的原型')
    expect(answer).not.toContain('代码与架构均经过严格测试')
  })

  it('does not claim qualifications absent from retrieved JD evidence', () => {
    const results = hybridRetrieve('React 岗位要求', MOCK_CHUNKS, 1)
    const answer = buildLocalRAGAnswer('React 岗位要求', results, true)

    expect(answer).toContain(results[0].chunk.content)
    expect(answer).toContain('不能直接声称具备')
    expect(answer).not.toContain('国家级二等奖')
  })

  it('does not call an external model when no CMS fact matches the question', async () => {
    const previousKey = process.env.DEEPSEEK_API_KEY
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 500 }))
    process.env.DEEPSEEK_API_KEY = 'test-key'

    try {
      const stream = await createRAGStream({
        messages: [{ id: 'question', role: 'user', content: '没有收录的个人经历是什么？' }],
        retrievalResults: [],
      })
      const reader = stream.getReader()
      let output = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        output += new TextDecoder().decode(value)
      }

      expect(fetchSpy).not.toHaveBeenCalled()
      expect(output).toContain('没有收录')
    } finally {
      fetchSpy.mockRestore()
      if (previousKey === undefined) delete process.env.DEEPSEEK_API_KEY
      else process.env.DEEPSEEK_API_KEY = previousKey
    }
  })

  it('fetchSemanticEmbedding returns null when no API keys are configured', async () => {
    const originalEnv = { ...process.env }
    delete process.env.EMBEDDING_API_KEY
    delete process.env.OPENAI_API_KEY
    delete process.env.DASHSCOPE_API_KEY

    try {
      const res = await fetchSemanticEmbedding('测试无外部Key时的行为')
      expect(res).toBeNull()
    } finally {
      process.env = originalEnv
    }
  })
})

