import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { find, findByID, create, db } = vi.hoisted(() => ({ find: vi.fn(), findByID: vi.fn(), create: vi.fn(), db: { beginTransaction: vi.fn(), commitTransaction: vi.fn(), rollbackTransaction: vi.fn() } }))
vi.mock('payload', () => ({ getPayload: async () => ({ find, findByID, create, db }), createLocalReq: async ({ req }: { req: unknown }) => req }))
vi.mock('@/payload.config', () => ({ default: Promise.resolve({}) }))
import { GET, POST } from './route'

const studioSecret = 'studio-route-test-secret'
const url = 'http://localhost:3001/api/studio/memory'
const authed = { 'x-studio-token': studioSecret }
const authedGet = () => new NextRequest(url, { headers: authed })

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('STUDIO_SECRET_KEY', studioSecret)
  vi.stubEnv('CLOUDFLARE_ACCESS_REQUIRED', 'false')
  db.beginTransaction.mockResolvedValue('private-tx')
})

describe('private studio access inside the route', () => {
  it('refuses reads and writes that reach the route without credentials', async () => {
    const read = await GET(new NextRequest(url))
    const write = await POST(new NextRequest(url, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'delete_approved', memoryId: '7' }),
    }))
    expect(read.status).toBe(404)
    expect(write.status).toBe(404)
    expect(find).not.toHaveBeenCalled()
    expect(findByID).not.toHaveBeenCalled()
  })

  it('refuses a wrong shared secret and the inbox-only secret', async () => {
    vi.stubEnv('STUDIO_INBOX_SECRET', 'inbox-only-secret-value')
    for (const token of ['wrong-secret-value', 'inbox-only-secret-value']) {
      expect((await GET(new NextRequest(url, { headers: { 'x-studio-token': token } }))).status).toBe(404)
    }
    expect(find).not.toHaveBeenCalled()
  })
})

describe('private studio reads', () => {
  it('keeps a new database empty without inventing personal facts', async () => {
    find.mockResolvedValue({ docs: [], hasNextPage: false })
    const res = await GET(authedGet())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, reflections: [], candidateMemories: [], approvedMemories: [] })
  })
  it('reports database failure instead of showing a usable fake memory board', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    find.mockRejectedValue(new Error('private database unavailable'))
    const res = await GET(authedGet())
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ success: false, error: '私人工作台数据暂时不可用，请稍后重试。' })
    vi.restoreAllMocks()
  })
})

describe('explicit private memory to knowledge draft', () => {
  const req = () => new NextRequest(url, {
    method: 'POST', headers: { 'content-type': 'application/json', ...authed },
    body: JSON.stringify({ action: 'create_knowledge_draft', memoryId: '7' }),
  })
  it('never publishes private approved memory automatically', async () => {
    findByID.mockResolvedValue({ id: 7, status: 'approved', title: 'Confirmed fact', content: 'Private reviewed text', category: 'project_experience', evidenceTag: 'Private evidence' })
    find.mockResolvedValue({ docs: [] })
    create.mockResolvedValue({ id: 10 })
    const res = await POST(req())
    expect(res.status).toBe(200)
    expect(create.mock.calls[0][0]).toMatchObject({ collection: 'ai-knowledge', data: { isPublic: false, content: 'Private reviewed text' } })
    expect(await res.json()).toMatchObject({ success: true, editUrl: '/admin/collections/ai-knowledge/10' })
  })
  it('refuses to export an unreviewed candidate', async () => {
    findByID.mockResolvedValue({ id: 7, status: 'candidate' })
    expect((await POST(req())).status).toBe(409)
    expect(create).not.toHaveBeenCalled()
  })
  it('opens the existing draft without overwriting CMS edits or duplicating it', async () => {
    findByID.mockResolvedValue({ id: 7, status: 'approved' })
    find.mockResolvedValue({ docs: [{ id: 10, isPublic: true }] })
    expect((await POST(req())).status).toBe(200)
    expect(create).not.toHaveBeenCalled()
  })
})

it('rolls back a manually submitted reflection if candidate persistence fails', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  create.mockResolvedValueOnce({ id: 9 }).mockRejectedValueOnce(new Error('candidate database failure'))
  const req = new NextRequest(url, {
    method: 'POST', headers: { 'content-type': 'application/json', ...authed },
    body: JSON.stringify({ action: 'submit_reflection', reflection: { title: 'Real reflection', type: 'technical', date: '2026-10-07', content: 'Testing a real API transaction', solution: 'Rollback all writes on candidate failure' } }),
  })
  const res = await POST(req)
  expect(res.status).toBe(503)
  expect(db.rollbackTransaction).toHaveBeenCalledWith('private-tx')
  expect(db.commitTransaction).not.toHaveBeenCalled()
  vi.restoreAllMocks()
})
