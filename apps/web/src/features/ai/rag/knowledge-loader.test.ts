import { afterEach, describe, expect, it, vi } from 'vitest'

const { findMock, queryMock } = vi.hoisted(() => ({
  findMock: vi.fn(),
  queryMock: vi.fn(),
}))

vi.mock('payload', () => ({ getPayload: async () => ({ find: findMock }) }))
vi.mock('@/payload.config', () => ({ default: Promise.resolve({}) }))
vi.mock('@/features/portfolio/data', () => ({
  getHydratedPortfolioData: async () => ({ projects: [], experiences: [], awards: [], skillGroups: [] }),
}))
vi.mock('@/features/worker/sync-worker', () => ({ generate1536Vector: () => Array(1536).fill(0) }))
vi.mock('./db-pool', () => ({ getPgPool: () => ({ query: queryMock }) }))

import { loadKnowledgeChunks } from './knowledge-loader'

const previousUsePostgres = process.env.USE_POSTGRES
const previousDatabaseUri = process.env.DATABASE_URI

afterEach(() => {
  if (previousUsePostgres === undefined) delete process.env.USE_POSTGRES
  else process.env.USE_POSTGRES = previousUsePostgres
  if (previousDatabaseUri === undefined) delete process.env.DATABASE_URI
  else process.env.DATABASE_URI = previousDatabaseUri
  vi.clearAllMocks()
})

describe('knowledge loader', () => {
  it('can retrieve published knowledge entries beyond the first 100', async () => {
    const docs = Array.from({ length: 102 }, (_, index) => ({
      id: index + 1, title: `Fact ${index + 1}`, category: 'skill', content: 'Published fact',
      evidenceTag: 'CMS fact', isPublic: true,
    }))
    findMock.mockImplementation(async (options) => ({
      docs: options.pagination === false ? docs : docs.slice(0, options.limit),
    }))

    const chunks = await loadKnowledgeChunks('Fact 102')
    expect(chunks.some((chunk) => chunk.title === 'Fact 102')).toBe(true)
  })

  it('returns no answerable facts when all CMS collections are empty', async () => {
    findMock.mockResolvedValue({ docs: [] })

    const chunks = await loadKnowledgeChunks('我的个人经历是什么？')

    expect(chunks).toEqual([])
  })

  it('uses the current public CMS fact even when a PostgreSQL index row is stale', async () => {
    process.env.USE_POSTGRES = 'true'
    process.env.DATABASE_URI = 'postgres://test'
    queryMock.mockResolvedValue({ rows: [{
      chunk_id: 'knowledge-1_chunk_0',
      metadata: { entityId: 'knowledge-1' },
      content: '旧事实',
      vector_score: 0.7,
    }] })
    findMock.mockResolvedValue({ docs: [{
      id: 1, title: '项目事实', category: 'project', content: '新事实',
      evidenceTag: '项目档案', isPublic: true,
    }] })

    const chunks = await loadKnowledgeChunks('项目事实')

    expect(findMock).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'ai-knowledge',
      where: { isPublic: { equals: true } },
    }))
    expect(chunks.find((chunk) => chunk.id === 'cms-1')).toMatchObject({
      content: '新事实', vectorScore: 0.7,
    })
    expect(chunks.some((chunk) => chunk.content === '旧事实')).toBe(false)
  })
})
