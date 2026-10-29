import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const rag = vi.hoisted(() => ({
  load: vi.fn<(...args: unknown[]) => Promise<KnowledgeChunk[]>>(async () => []),
  stream: vi.fn<(config: { retrievalResults: RetrievalResult[] }) => Promise<ReadableStream<Uint8Array>>>(),
}))
vi.mock('@/features/ai/rag/knowledge-loader', () => ({ loadKnowledgeChunks: rag.load }))
vi.mock('@/features/ai/rag/llm-stream', () => ({
  createRAGStream: rag.stream,
}))

import { OPTIONS, POST } from './route'
import { acquireChatSlot, MAX_ACTIVE_CHATS } from '@/features/ai/chat-capacity'
import type { KnowledgeChunk, RetrievalResult } from '@/features/ai/rag/types'

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
  rag.load.mockReset().mockResolvedValue([])
  rag.stream.mockReset().mockImplementation(async () => new Response('event: done\ndata: {}\n\n').body!)
})
afterEach(() => { vi.unstubAllEnvs() })

describe('the home page can ask the AI directly', () => {
  it('retrieves the confirmed project case when a follow-up omits its name and wording', async () => {
    const caseChunk: KnowledgeChunk = {
      id: 'project-jaxson-ai-space', title: '项目：Jaxson AI Space', category: 'project',
      content: '通过多轮界面审计确定信息展示的取舍：重点直接可见，不依赖访客点击展开；内容既不能密密麻麻，也不能删得过空。',
      evidenceTag: '项目档案：Jaxson AI Space', keywords: ['Jaxson AI Space'], project: 'jaxson-ai-space',
    }
    rag.load.mockResolvedValue([caseChunk])
    const response = await POST(ask(portfolio, { messages: [
      { role: 'user', content: '在 Jaxson AI Space 里，你做过什么具体的产品判断？请举一个例子。' },
      { role: 'assistant', content: '项目详情里，重点信息直接可见，不依赖点击展开。' },
      { role: 'user', content: '那为什么不把详细介绍折叠起来？' },
    ] }, '203.0.113.90'))
    expect(response.status).toBe(200)
    await response.text()
    expect(rag.stream.mock.calls[0][0].retrievalResults.map((item: { chunk: KnowledgeChunk }) => item.chunk.id)).toContain(caseChunk.id)
  })
  it('returns a bounded busy response when all generation slots are occupied', async () => {
    const slots = Array.from({ length: MAX_ACTIVE_CHATS }, () => acquireChatSlot()!)
    try {
      const response = await POST(ask(portfolio, undefined, '203.0.113.80'))
      expect(response.status).toBe(503)
      expect(response.headers.get('retry-after')).toBe('5')
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(portfolio)
    } finally { slots.forEach(done => done()) }
  })
  it('rejects an oversized body by bytes even when the large field is ignored by the schema', async () => {
    const response = await POST(ask(portfolio, { messages: [{ role: 'user', content: '你好' }], padding: 'x'.repeat(65536) }, '203.0.113.81'))
    expect(response.status).toBe(413)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(portfolio)
  })

  it('rejects a chunked oversized body without trusting Content-Length', async () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ messages: [{ role: 'user', content: '你好' }], padding: 'x'.repeat(65536) }))
    const body = new ReadableStream({ start(controller) { controller.enqueue(bytes.slice(0, 20000)); controller.enqueue(bytes.slice(20000)); controller.close() } })
    const options = { method: 'POST', body, duplex: 'half' as const, headers: { 'content-type': 'application/json', 'x-real-ip': '203.0.113.82' } }
    const request = new NextRequest(url, options)
    expect((await POST(request)).status).toBe(413)
  })

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
    for (let index = 0; index < 21; index++) { limited = await POST(ask(portfolio, undefined, '203.0.113.9')); await limited.body?.cancel() }
    expect(limited.status).toBe(429)
    expect(limited.headers.get('Access-Control-Allow-Origin')).toBe(portfolio)
  })

  it('does not open the API to other sites', async () => {
    const response = await POST(ask('https://evil.example', undefined, '203.0.113.10'))
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
    await response.body?.cancel()
  })
})
