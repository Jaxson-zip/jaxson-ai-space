import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/features/ai/rag/knowledge-loader', () => ({ loadKnowledgeChunks: async () => [] }))
vi.mock('@/features/ai/rag/retriever', () => ({ groundedRetrieve: () => [] }))
vi.mock('@/features/ai/rag/llm-stream', () => ({
  createRAGStream: async () => new Response('event: done\ndata: {}\n\n').body,
}))

import { OPTIONS, POST } from './route'
import { acquireChatSlot, MAX_ACTIVE_CHATS } from '@/features/ai/chat-capacity'

const portfolio = 'https://portfolio.testsite.net'
const url = 'https://cms.testsite.net/api/chat'
const ask = (origin: string | null, body: unknown = { messages: [{ role: 'user', content: '你会哪些技术？' }] }, ip = '203.0.113.7') =>
  new NextRequest(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-real-ip': ip, ...(origin ? { origin } : {}) },
    body: JSON.stringify(body),
  })

beforeEach(() => { vi.stubEnv('NEXT_PUBLIC_PORTFOLIO_URL', portfolio) })
afterEach(() => { vi.unstubAllEnvs() })

describe('the home page can ask the AI directly', () => {
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
