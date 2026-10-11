import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { db, find, create } = vi.hoisted(() => ({
  db: { beginTransaction: vi.fn(), commitTransaction: vi.fn(), rollbackTransaction: vi.fn() },
  find: vi.fn(), create: vi.fn(),
}))
vi.mock('payload', () => ({ getPayload: async () => ({ db, find, create }), createLocalReq: async () => ({}) }))
vi.mock('@/payload.config', () => ({ default: Promise.resolve({}) }))
import { POST } from './route'

const message = { message: 'fp 完成接口联调，修复超时问题', senderId: 'owner', channelId: 'openclaw-weixin', accountId: 'main', conversationId: 'owner', messageId: 'msg-1' }
const request = (body = message, token = 'test-inbox-secret') => new NextRequest('http://localhost:3001/api/studio/inbox', {
  method: 'POST', headers: { 'content-type': 'application/json', 'x-studio-token': token }, body: JSON.stringify(body),
})
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('STUDIO_INBOX_SECRET', 'test-inbox-secret')
  vi.stubEnv('STUDIO_INBOX_ALLOWED_IDENTITIES', JSON.stringify([{ channelId: message.channelId, accountId: 'main', senderId: 'owner' }]))
  db.beginTransaction.mockResolvedValue('tx-1')
  find.mockResolvedValue({ docs: [] })
  create.mockImplementation(async ({ collection, data }) => ({ ...data, id: collection === 'reflections' ? 7 : 8 }))
})
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })
describe('private inbox persistence', () => {
  it('rejects an unlisted sender even with the correct bot token', async () => {
    expect((await POST(request({ ...message, senderId: 'stranger' }))).status).toBe(403)
    expect(create).not.toHaveBeenCalled()
  })
  it('fails closed without a sender allowlist', async () => {
    vi.stubEnv('STUDIO_INBOX_ALLOWED_IDENTITIES', '')
    expect((await POST(request())).status).toBe(503)
    expect(create).not.toHaveBeenCalled()
  })
  it('requires stable transport IDs', async () => {
    expect((await POST(request({ ...message, messageId: '' }))).status).toBe(400)
  })
  it('never acknowledges a database failure, including development', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    create.mockRejectedValue(new Error('database unavailable'))
    const res = await POST(request())
    expect(res.status).toBe(503)
    expect((await res.json()).success).toBe(false)
    expect(db.rollbackTransaction).toHaveBeenCalledWith('tx-1')
  })
  it('replays a persisted receipt without creating more private records', async () => {
    const first = await POST(request())
    expect(first.status).toBe(200)
    const saved = create.mock.calls.find(([args]) => args.collection === 'reflections')?.[0].data
    expect(saved.inboxKey).toMatch(/^[a-f0-9]{64}$/)
    expect(saved.extractionStatus).toBe('extracted')
    expect(db.commitTransaction).toHaveBeenCalledWith('tx-1')
    create.mockClear()
    find.mockResolvedValue({ docs: [{ ...saved, id: 7 }] })
    const replay = await POST(request())
    expect(await replay.json()).toMatchObject({ success: true, duplicate: true, reflectionId: '7' })
    expect(create).not.toHaveBeenCalled()
  })
  it('rejects reusing a message ID for different content', async () => {
    await POST(request())
    const saved = create.mock.calls.find(([args]) => args.collection === 'reflections')?.[0].data
    find.mockResolvedValue({ docs: [{ ...saved, id: 7 }] })
    expect((await POST(request({ ...message, message: 'fp changed text' }))).status).toBe(409)
  })
})
