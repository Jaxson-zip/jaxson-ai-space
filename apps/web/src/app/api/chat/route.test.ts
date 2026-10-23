import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/features/ai/rag/knowledge-loader', () => ({ loadKnowledgeChunks: async () => [] }))
vi.mock('@/features/ai/rag/retriever', () => ({ groundedRetrieve: () => [] }))
vi.mock('@/features/ai/rag/llm-stream', () => ({
  createRAGStream: async () => new Response('event: done\ndata: {}\n\n').body,
}))

import { OPTIONS, POST } from './route'

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
