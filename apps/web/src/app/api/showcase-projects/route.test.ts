import { afterEach, describe, expect, it, vi } from 'vitest'

const { findMock } = vi.hoisted(() => ({ findMock: vi.fn() }))
vi.mock('payload', () => ({ getPayload: async () => ({ find: findMock }) }))
vi.mock('@/payload.config', () => ({ default: Promise.resolve({}) }))

import { GET, OPTIONS } from './route'

const originalPortfolioUrl = process.env.NEXT_PUBLIC_PORTFOLIO_URL

afterEach(() => {
  vi.clearAllMocks()
  if (originalPortfolioUrl === undefined) delete process.env.NEXT_PUBLIC_PORTFOLIO_URL
  else process.env.NEXT_PUBLIC_PORTFOLIO_URL = originalPortfolioUrl
})

describe('public showcase projects', () => {
  it('respects an empty CMS result instead of republishing old projects', async () => {
    findMock.mockResolvedValue({ docs: [] })
    const response = await GET(new Request('http://localhost:3001/api/showcase-projects'))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ source: 'cms', projects: [] })
  })

  it('does not send static projects when the CMS fails', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    findMock.mockRejectedValue(new Error('database offline'))
    const response = await GET(new Request('http://localhost:3001/api/showcase-projects'))
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'Project data is temporarily unavailable' })
    log.mockRestore()
  })

  it('allows the configured public hostname to fetch projects across origins', async () => {
    process.env.NEXT_PUBLIC_PORTFOLIO_URL = 'https://portfolio.testsite.net'
    const response = await OPTIONS(new Request('https://cms.testsite.net/api/showcase-projects', {
      method: 'OPTIONS',
      headers: { origin: 'https://portfolio.testsite.net' },
    }))
    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://portfolio.testsite.net')
  })
})
