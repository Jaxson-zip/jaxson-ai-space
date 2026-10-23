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

  it('marks featured projects and orders by the sort number, blanks last, ties in CMS order', async () => {
    const doc = (slug: string, extra: Record<string, unknown> = {}) => ({ slug, title: slug, role: 'r', category: 'c', status: 's', summary: 's', ...extra })
    findMock.mockResolvedValue({ docs: [
      doc('a'),
      doc('b', { sortOrder: 2, featured: true }),
      doc('c', { sortOrder: 1 }),
      doc('d', { featured: null }),
      doc('e', { sortOrder: 2 }),
    ] })
    const response = await GET(new Request('http://localhost:3001/api/showcase-projects'))
    const { projects } = await response.json()
    expect(projects.map((project: { slug: string }) => project.slug)).toEqual(['c', 'b', 'e', 'a', 'd'])
    expect(projects.map((project: { featured: boolean }) => project.featured)).toEqual([false, true, false, false, false])
    expect(findMock.mock.calls[0][0].sort).toBe('createdAt')
  })

  it('sends the uploaded demo video as an absolute URL, or an empty string without one', async () => {
    const doc = (slug: string, extra: Record<string, unknown> = {}) => ({ slug, title: slug, role: 'r', category: 'c', status: 's', summary: 's', ...extra })
    findMock.mockResolvedValue({ docs: [
      doc('with-video', { demoVideo: { url: '/api/media/file/demo.mp4', mimeType: 'video/mp4' } }),
      doc('without-video', { demoVideo: 7 }),
      doc('not-a-video', { demoVideo: { url: '/api/media/file/shot.png', mimeType: 'image/png' } }),
    ] })
    const { projects } = await (await GET(new Request('http://localhost:3001/api/showcase-projects'))).json()
    expect(projects.map((project: { video: string }) => project.video)).toEqual(['http://localhost:3001/api/media/file/demo.mp4', '', ''])
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
