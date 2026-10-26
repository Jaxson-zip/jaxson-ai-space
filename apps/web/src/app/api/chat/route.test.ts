import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import type { KnowledgeChunk } from '@/features/ai/rag/types'

vi.mock('@/features/ai/rag/knowledge-loader', () => ({ loadKnowledgeChunks: vi.fn(async () => []) }))

import { OPTIONS, POST } from './route'
import { loadKnowledgeChunks } from '@/features/ai/rag/knowledge-loader'

const portfolio = 'https://portfolio.testsite.net'
const url = 'https://cms.testsite.net/api/chat'
const ask = (origin: string | null, body: unknown = { messages: [{ role: 'user', content: '你会哪些技术？' }] }, ip = '203.0.113.7') =>
  new NextRequest(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-real-ip': ip, ...(origin ? { origin } : {}) },
    body: JSON.stringify(body),
  })

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_PORTFOLIO_URL', portfolio)
  for (const key of ['DEEPSEEK_API_KEY', 'DASHSCOPE_API_KEY', 'OPENAI_API_KEY']) vi.stubEnv(key, '')
  vi.mocked(loadKnowledgeChunks).mockReset().mockResolvedValue([])
})
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })

describe('the home page can ask the AI directly', () => {
  it('answers the preflight from the portfolio origin only', async () => {
    const allowed = await OPTIONS(new NextRequest(url, { method: 'OPTIONS', headers: { origin: portfolio } }))
    expect(allowed.status).toBe(204)
    expect(allowed.headers.get('Access-Control-Allow-Origin')).toBe(portfolio)
    expect(allowed.headers.get('Access-Control-Allow-Methods')).toContain('POST')
    expect(allowed.headers.get('Access-Control-Allow-Headers')).toMatch(/content-type/i)
    expect(allowed.headers.get('Access-Control-Allow-Credentials')).toBeNull()

    const other = await OPTIONS(new NextRequest(url, { method: 'OPTIONS', headers: { origin: 'https://evil.example' } }))
    expect(other.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })

  it('lets the portfolio read the streamed answer', async () => {
    const response = await POST(ask(portfolio))
    expect(response.status).toBe(200)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(portfolio)
    expect(response.headers.get('Vary')).toContain('Origin')
    expect(await response.text()).toContain('event: done')
  })

  it('lets the portfolio read errors too, so it can explain them', async () => {
    const invalid = await POST(ask(portfolio, { messages: [] }, '203.0.113.8'))
    expect(invalid.status).toBe(400)
    expect(invalid.headers.get('Access-Control-Allow-Origin')).toBe(portfolio)
    let limited = invalid
    for (let index = 0; index < 21; index++) limited = await POST(ask(portfolio, undefined, '203.0.113.9'))
    expect(limited.status).toBe(429)
    expect(limited.headers.get('Access-Control-Allow-Origin')).toBe(portfolio)
  })

  it('does not open the API to other sites', async () => {
    const response = await POST(ask('https://evil.example', undefined, '203.0.113.10'))
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })
})

describe('followup retrieval uses fresh public knowledge', () => {
  const todo: KnowledgeChunk = {
    id: 'todo', title: '项目：待办备忘 Todo Memo', category: 'project',
    content: '支持任务分组和离线运行。', evidenceTag: '公开待办档案', keywords: ['待办备忘', 'Todo Memo'],
  }
  const resume: KnowledgeChunk = {
    id: 'resume', title: '项目：锐历简历工作台', category: 'project',
    content: '支持中文简历排版。', evidenceTag: '公开简历档案', keywords: ['锐历简历'],
  }
  // Same shared sections emitted by knowledge-loader; section labels are not record identities.
  const loaderProject = (chunk: KnowledgeChunk, project: string): KnowledgeChunk => ({
    ...chunk, project,
    content: `【项目简介】${chunk.content}\n【项目背景】解决日常问题。\n【技术方案】React\n【交付结果】已完成。\n【技术栈】React、TypeScript\n【状态】已上线`,
    keywords: [...chunk.keywords, project, 'React', 'TypeScript', '已上线'],
  })
  const loadedTodo = loaderProject(todo, 'todo-memo')
  const loadedResume = loaderProject(resume, 'resume-workbench')
  const skills: KnowledgeChunk = {
    id: 'skills-summary', title: '技术栈与能力图谱', category: 'skill',
    content: '【前端】React、TypeScript', evidenceTag: '公开技能档案', keywords: ['技能', '技术栈', 'React', 'TypeScript'],
  }
  const messages = [
    { role: 'user', content: '请介绍待办备忘 Todo Memo 的功能。' },
    { role: 'assistant', content: '待办支持任务分组。' },
    { role: 'user', content: '能再展开讲讲吗？' },
  ]

  it('keeps a named project followup on that record despite shared loader labels and global skills', async () => {
    vi.mocked(loadKnowledgeChunks).mockResolvedValue([loadedTodo, loadedResume, skills])
    const response = await POST(ask(null, { messages: [
      { role: 'user', content: '请介绍 Todo Memo 项目' },
      messages[1], { role: 'user', content: '它的技术栈是什么？' },
    ] }, '203.0.113.51'))
    const output = await response.text()
    expect(output).toContain('公开待办档案')
    expect(output).not.toContain('公开简历档案')
    expect(output).not.toContain('公开技能档案')
  })

  it('matches the combined Chinese and English name against the parenthesized CMS title', async () => {
    vi.mocked(loadKnowledgeChunks).mockResolvedValue([
      { ...loadedTodo, title: '项目：待办备忘 (Todo Memo)' }, loadedResume, skills,
    ])
    const response = await POST(ask(null, { messages }, '203.0.113.55'))
    const output = await response.text()
    expect(output).toContain('公开待办档案')
    expect(output).not.toContain('公开简历档案')
    expect(output).not.toContain('公开技能档案')
  })

  it('does not substitute another public project or skills after the named project is withdrawn', async () => {
    vi.mocked(loadKnowledgeChunks).mockResolvedValue([loadedResume, skills])
    const response = await POST(ask(null, { messages: [
      { role: 'user', content: '请介绍 Todo Memo 项目' },
      messages[1], { role: 'user', content: '它的技术栈是什么？' },
    ] }, '203.0.113.52'))
    const output = await response.text()
    expect(output).toContain('"evidence":[]')
    expect(output).toContain('没有收录')
    expect(output).not.toContain('公开简历档案')
    expect(output).not.toContain('公开技能档案')
  })

  it('does not guess a global skills subject for a pronoun question without history', async () => {
    vi.mocked(loadKnowledgeChunks).mockResolvedValue([loadedTodo, loadedResume, skills])
    const response = await POST(ask(null, { messages: [{ role: 'user', content: '它的技术栈是什么？' }] }, '203.0.113.53'))
    const output = await response.text()
    expect(output).toContain('"evidence":[]')
    expect(output).toContain('没有收录')
  })

  it('does not change a missing project identity when the retrieval query budget cuts its name', async () => {
    vi.mocked(loadKnowledgeChunks).mockResolvedValue([loadedTodo, loadedResume, skills])
    const question = '能再展开讲讲吗？'
    const topicBudget = 2500 - question.length - 1
    const previous = `请介绍${' '.repeat(topicBudget - '请介绍Todo Memo'.length)}Todo Memo Pro 项目`
    const response = await POST(ask(null, { messages: [
      { role: 'user', content: previous }, messages[1], { role: 'user', content: question },
    ] }, '203.0.113.54'))
    const output = await response.text()
    expect(output).toContain('"evidence":[]')
    expect(vi.mocked(loadKnowledgeChunks).mock.calls[0][0]?.length).toBeLessThanOrEqual(2500)
  })

  it('retrieves the named project for an expansion without pulling in unrelated projects', async () => {
    vi.mocked(loadKnowledgeChunks).mockResolvedValue([todo, resume])
    const response = await POST(ask(null, { messages }, '203.0.113.40'))
    const output = await response.text()
    expect(output).toContain('公开待办档案')
    expect(output).not.toContain('公开简历档案')
    expect(vi.mocked(loadKnowledgeChunks).mock.calls[0][0]).toContain('Todo Memo')
  })

  it('keeps a pronoun question about one project from becoming a request for every project', async () => {
    vi.mocked(loadKnowledgeChunks).mockResolvedValue([todo, resume])
    const response = await POST(ask(null, { messages: [...messages.slice(0, 2), { role: 'user', content: '这个项目的功能有哪些？' }] }, '203.0.113.48'))
    const output = await response.text()
    expect(output).toContain('公开待办档案')
    expect(output).not.toContain('公开简历档案')
  })

  it.each(['Todo Memo 项目都有哪些功能？', '请介绍已经上线的 Todo Memo 项目'])(
    'does not reuse the previous list wording: %s', async (previous) => {
      vi.mocked(loadKnowledgeChunks).mockResolvedValue([todo, resume])
      const response = await POST(ask(null, { messages: [{ role: 'user', content: previous }, ...messages.slice(1)] }, '203.0.113.41'))
      const output = await response.text()
      expect(output).toContain('公开待办档案')
      expect(output).not.toContain('公开简历档案')
    },
  )

  it('recovers the same user topic through consecutive followups', async () => {
    vi.mocked(loadKnowledgeChunks).mockResolvedValue([todo, resume])
    const response = await POST(ask(null, { messages: [
      ...messages, { role: 'assistant', content: '支持离线运行。' },
      { role: 'user', content: '它的技术栈是什么？' },
      { role: 'assistant', content: '未经证实的技术细节。' },
      { role: 'user', content: '继续' },
    ] }, '203.0.113.42'))
    const output = await response.text()
    expect(output).toContain('公开待办档案')
    expect(output).not.toContain('公开简历档案')
    expect(vi.mocked(loadKnowledgeChunks).mock.calls[0][0]).not.toContain('未经证实')
  })

  it('rechecks current public records after a project is withdrawn or made private', async () => {
    vi.mocked(loadKnowledgeChunks).mockResolvedValueOnce([todo, resume]).mockResolvedValueOnce([resume])
    const first = await POST(ask(null, { messages: [messages[0]] }, '203.0.113.43'))
    expect(await first.text()).toContain('公开待办档案')
    const followup = await POST(ask(null, { messages }, '203.0.113.43'))
    const output = await followup.text()
    expect(output).toContain('"evidence":[]')
    expect(output).toContain('没有收录')
    expect(output).not.toContain('公开待办档案')
    expect(output).not.toContain('公开简历档案')
    expect(loadKnowledgeChunks).toHaveBeenCalledTimes(2)
  })

  it.each(['量子计算经验', '那你的实习经历呢？', '那锐历简历工作台呢？'])(
    'does not contaminate a new question with old project context: %s', async (question) => {
      const internship: KnowledgeChunk = { id: 'internship', title: '实习经历', content: '负责订单中心开发。', category: 'internship', keywords: ['实习'], evidenceTag: '公开实习档案' }
      vi.mocked(loadKnowledgeChunks).mockResolvedValue([todo, resume, internship])
      const response = await POST(ask(null, { messages: [...messages.slice(0, 2), { role: 'user', content: question }] }, '203.0.113.44'))
      const output = await response.text()
      expect(loadKnowledgeChunks).toHaveBeenCalledWith(question)
      expect(output).not.toContain('公开待办档案')
      if (question === '量子计算经验') expect(output).toContain('"evidence":[]')
      if (question.includes('实习')) expect(output).toContain('公开实习档案')
      if (question.includes('锐历')) expect(output).toContain('公开简历档案')
    },
  )

  it('cannot use assistant assertions as the retrieval topic or evidence', async () => {
    vi.mocked(loadKnowledgeChunks).mockResolvedValue([todo, resume])
    const response = await POST(ask(null, { messages: [
      { role: 'user', content: '量子计算经验' },
      { role: 'assistant', content: 'Todo Memo 支持量子计算。' },
      { role: 'user', content: '能再展开讲讲吗？' },
    ] }, '203.0.113.45'))
    const output = await response.text()
    expect(output).toContain('"evidence":[]')
    expect(output).toContain('没有收录')
    expect(vi.mocked(loadKnowledgeChunks).mock.calls[0][0]).not.toContain('Todo Memo')
  })

  it('refuses a followup without a user topic even when public projects exist', async () => {
    vi.mocked(loadKnowledgeChunks).mockResolvedValue([todo, resume])
    const response = await POST(ask(null, { messages: [messages[2]] }, '203.0.113.46'))
    expect(await response.text()).toContain('"evidence":[]')
  })

  it('sends the original current question to the generator after expanding retrieval', async () => {
    vi.mocked(loadKnowledgeChunks).mockResolvedValue([todo, resume])
    vi.stubEnv('DEEPSEEK_API_KEY', 'test-key')
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      'data: {"choices":[{"delta":{"content":"已核实。"}}]}\n\ndata: [DONE]\n\n',
    ))
    const response = await POST(ask(null, { messages }, '203.0.113.47'))
    await response.text()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const payload = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))
    expect(payload.messages.at(-1)).toEqual(messages.at(-1))
    expect(payload.messages[0].content).toContain('支持任务分组和离线运行')
    expect(payload.messages[0].content).not.toContain('支持中文简历排版')
    expect(vi.mocked(loadKnowledgeChunks).mock.calls[0][0]).toContain('Todo Memo')
  })
})
