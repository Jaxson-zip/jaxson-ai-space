import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import plugin from '../../../../../integrations/openclaw/jaxson-inbox/index.mjs'

const context = { channelId: 'openclaw-weixin', accountId: 'main', conversationId: 'owner', senderId: 'owner', messageId: 'one' }
let handler: (event: Record<string, unknown>, ctx: Record<string, unknown>) => Promise<{ handled: boolean; text?: string } | undefined>
const fetchMock = vi.fn()
beforeEach(() => {
  vi.stubEnv('SPACE_BOT_SECRET', 'only-test-secret')
  vi.stubEnv('SPACE_BOT_BASE_URL', 'http://localhost:3001')
  vi.stubEnv('STUDIO_INBOX_ALLOWED_IDENTITIES', JSON.stringify([{ channelId: context.channelId, accountId: 'main', senderId: 'owner' }]))
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  plugin.register({ on: (name: string, fn: typeof handler) => { expect(name).toBe('before_dispatch'); handler = fn } })
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })
describe('OpenClaw before_dispatch adapter', () => {
  it('waits for a real Todo response beyond four seconds without retrying the mutation', async () => {
    vi.useFakeTimers()
    try {
      vi.stubEnv('TODO_BOT_SECRET', 'only-test-todo-secret')
      vi.stubEnv('TODO_BOT_RESPONSE_MODE', 'reply-v1')
      vi.stubEnv('TODO_BOT_TIMEOUT_MS', '')
      fetchMock.mockImplementation((_url, { signal }) => new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve(Response.json({ reply: '已完成：联调测试' })), 6000)
        signal.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('aborted')) }, { once: true })
      }))
      const result = handler({ content: 'td 完成 联调测试' }, context)
      await vi.advanceTimersByTimeAsync(6000)
      expect((await result)?.text).toBe('已完成：联调测试')
      expect(fetchMock).toHaveBeenCalledTimes(1)
    } finally { vi.useRealTimers() }
  })
  it('bounds Todo waiting to ten seconds and never automatically repeats an uncertain write', async () => {
    vi.useFakeTimers()
    try {
      vi.stubEnv('TODO_BOT_SECRET', 'only-test-todo-secret')
      vi.stubEnv('TODO_BOT_RESPONSE_MODE', 'reply-v1')
      vi.stubEnv('TODO_BOT_TIMEOUT_MS', '')
      fetchMock.mockImplementation((_url, { signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
      }))
      const result = handler({ content: 'td 联调测试' }, context)
      let settled = false
      void result.then(() => { settled = true })
      await vi.advanceTimersByTimeAsync(9999)
      expect(settled).toBe(false)
      await vi.advanceTimersByTimeAsync(1)
      expect((await result)?.text).toContain('先检查目标系统')
      expect(fetchMock).toHaveBeenCalledTimes(1)
    } finally { vi.useRealTimers() }
  })
  it('relays the actual Todo reply-only API without claiming a query saved a record', async () => {
    vi.stubEnv('TODO_BOT_BASE_URL', 'https://todo.example.test')
    vi.stubEnv('TODO_BOT_SECRET', 'only-test-todo-secret')
    vi.stubEnv('TODO_BOT_RESPONSE_MODE', 'reply-v1')
    fetchMock.mockResolvedValue(Response.json({ reply: '当前未完成任务：\n1. 准备面试' }))
    const results = await Promise.all([
      handler({ content: 'td 任务列表' }, context),
      handler({ content: 'td 任务列表' }, context),
    ])
    expect(results[0]?.text).toBe('当前未完成任务：\n1. 准备面试')
    expect(results[1]).toEqual(results[0])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://todo.example.test/api/bot/message')
    expect(fetchMock.mock.calls[0][1].headers['x-bot-secret']).toBe('only-test-todo-secret')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ senderId: 'owner', text: '任务列表', messageId: 'one' })
    expect((await handler({ content: '转复盘' }, { ...context, messageId: 'two' }))?.text).toContain('没有最近')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it('accepts an explicitly authorized WeCom owner without allowing other channel identities', async () => {
    const wecom = { ...context, channelId: 'wecom', accountId: 'work', senderId: 'member' }
    vi.stubEnv('STUDIO_INBOX_ALLOWED_IDENTITIES', JSON.stringify([{ channelId: 'wecom', accountId: 'work', senderId: 'member' }]))
    fetchMock.mockResolvedValue(Response.json({ success: true, reply: '已保存企业微信复盘', reflectionId: '8' }))
    expect((await handler({ content: 'fp work reflection' }, wecom))?.text).toBe('已保存企业微信复盘')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject(wecom)
    fetchMock.mockClear()
    await handler({ content: 'fp work reflection', isGroup: true }, wecom)
    await handler({ content: 'fp work reflection' }, { ...wecom, accountId: 'other' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('explains account binding for the Todo API silent unbound response', async () => {
    vi.stubEnv('TODO_BOT_SECRET', 'only-test-todo-secret')
    vi.stubEnv('TODO_BOT_RESPONSE_MODE', 'reply-v1')
    fetchMock.mockResolvedValue(Response.json({ reply: '' }))
    const result = await handler({ content: 'td 任务列表' }, context)
    expect(result?.text).toContain('尚未绑定')
    expect(result?.text).toContain('td 绑定')
    expect(result?.text).not.toContain('已保存')
    expect((await handler({ content: '转复盘' }, { ...context, messageId: 'two' }))?.text).toContain('没有最近')
  })
  it.each([
    { success: false, reply: '错误回复' },
    { error: 'not saved', reply: '错误回复' },
    { reply: 1 },
    null,
  ])('rejects invalid or contradictory Todo replies: %j', async (body) => {
    vi.stubEnv('TODO_BOT_SECRET', 'only-test-todo-secret')
    vi.stubEnv('TODO_BOT_RESPONSE_MODE', 'reply-v1')
    fetchMock.mockResolvedValue(Response.json(body))
    expect((await handler({ content: 'td 准备面试' }, context))?.text).toContain('未确认保存')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it('does not loosen the default Todo contract without explicitly opting into reply-v1', async () => {
    vi.stubEnv('TODO_BOT_SECRET', 'only-test-todo-secret')
    vi.stubEnv('TODO_BOT_RESPONSE_MODE', '')
    fetchMock.mockResolvedValue(Response.json({ reply: '未知系统回复' }))
    expect((await handler({ content: 'td 准备面试' }, context))?.text).toContain('未确认保存')
  })
  it('refuses unknown Todo response modes before sending credentials', async () => {
    vi.stubEnv('TODO_BOT_SECRET', 'only-test-todo-secret')
    vi.stubEnv('TODO_BOT_RESPONSE_MODE', 'anything')
    expect((await handler({ content: 'td 准备面试' }, context))?.text).toContain('未确认保存')
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('leaves ordinary conversations alone', async () => {
    expect(await handler({ content: '你好，今天聊点什么？' }, context)).toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('shows Todo commands in the owner help once the destination is configured', async () => {
    vi.stubEnv('JAXSON_INBOX_ONLY', 'true')
    vi.stubEnv('TODO_BOT_SECRET', 'only-test-todo-secret')
    vi.stubEnv('TODO_BOT_BASE_URL', 'https://todo.example.test')
    const result = await handler({ content: '你好' }, context)
    expect(result?.text).toContain('td 任务列表')
    expect(result?.text).toContain('td 明天准备面试')
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('inbox-only deployment consumes ordinary messages and groups without forwarding or invoking AI', async () => {
    vi.stubEnv('JAXSON_INBOX_ONLY', 'true')
    expect(await handler({ content: '普通聊天' }, context)).toMatchObject({ handled: true })
    expect(await handler({ content: 'fp 群聊', isGroup: true }, context)).toEqual({ handled: true })
    expect(await handler({ content: '普通聊天' }, { ...context, senderId: 'unknown' })).toEqual({ handled: true })
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('cannot forward unknown senders or group messages', async () => {
    await handler({ content: 'fp private text' }, { ...context, senderId: 'unknown' })
    await handler({ content: 'fp private text', isGroup: true }, context)
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('does not claim success on 401 and does not retry it', async () => {
    fetchMock.mockResolvedValue(Response.json({ error: 'Unauthorized' }, { status: 401 }))
    const result = await handler({ content: 'fp private text' }, context)
    expect(result).toMatchObject({ handled: true })
    expect(result?.text).toContain('未确认保存')
    expect(result?.text).not.toContain('成功')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it('coalesces simultaneous duplicates and sends stable inbox identity', async () => {
    fetchMock.mockResolvedValue(Response.json({ success: true, reply: '已存入私人工作台', reflectionId: '7' }))
    const results = await Promise.all([handler({ content: 'fp private text' }, context), handler({ content: 'fp private text' }, context)])
    expect(results[0]).toEqual(results[1])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject(context)
  })
  it('only retries idempotent studio writes on a temporary failure', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({}, { status: 503 })).mockResolvedValueOnce(Response.json({ success: true, reply: '已保存', reflectionId: '7' }))
    expect((await handler({ content: 'fp private text' }, context))?.text).toBe('已保存')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][1].body).toBe(fetchMock.mock.calls[1][1].body)
  })
  it('checks a successful HTTP response still represents a persisted record', async () => {
    fetchMock.mockResolvedValue(Response.json({ reply: 'Fake success' }))
    expect((await handler({ content: 'fp private text' }, context))?.text).toContain('未确认保存')
  })
  it('does not pretend corrections delete the original or share another conversation', async () => {
    fetchMock.mockResolvedValue(Response.json({ success: true, reply: '已保存', reflectionId: '7' }))
    await handler({ content: 'fp private text' }, context)
    const result = await handler({ content: '转复盘' }, { ...context, messageId: 'two' })
    expect(result?.text).toContain('原记录保留')
    expect(result?.text).not.toContain('撤回')
    const other = await handler({ content: '转复盘' }, { ...context, conversationId: 'other', messageId: 'three' })
    expect(other?.text).toContain('没有最近')
  })
  it('aborts a stalled request and returns an honest failure within the retry budget', async () => {
    vi.useFakeTimers()
    vi.stubEnv('JAXSON_FORWARD_TIMEOUT_MS', '500')
    fetchMock.mockImplementation((_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
    }))
    const result = handler({ content: 'fp stalled request' }, context)
    await vi.advanceTimersByTimeAsync(1200)
    expect((await result)?.text).toContain('未确认保存')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })
  it('does not automatically retry the external Todo system on failure', async () => {
    vi.stubEnv('TODO_BOT_SECRET', 'only-test-todo-secret')
    fetchMock.mockResolvedValue(Response.json({ error: 'down' }, { status: 503 }))
    expect((await handler({ content: 'td prepare a task' }, context))?.text).toContain('未确认保存')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
