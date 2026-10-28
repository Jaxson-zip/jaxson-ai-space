import React from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import AIPage from '@/app/(frontend)/ai/page'

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
afterEach(() => {
  cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks()
  if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard)
  else Reflect.deleteProperty(navigator, 'clipboard')
})

const encoder = new TextEncoder()
const event = (type: string, data: object) => `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`

// The page also loads the published project list; answer it separately so
// `chat` only records chat requests.
function stubFetch(chat: (url: string, init?: RequestInit) => unknown, projects: object[] = []) {
  vi.stubGlobal('fetch', (url: string, init?: RequestInit) =>
    String(url).includes('/api/showcase-projects')
      ? Promise.resolve(Response.json({ source: 'cms', projects }))
      : chat(url, init))
}

it('offers suggestion chips only for published projects', async () => {
  stubFetch(vi.fn(), [{ slug: 'todo-memo', title: '待办备忘 (Todo Memo)', shortTitle: '待办备忘 (Todo Memo)' }])
  render(React.createElement(AIPage))
  expect(await screen.findByRole('button', { name: /待办备忘/ })).toBeTruthy()
  expect(screen.getByRole('button', { name: /实习经历/ })).toBeTruthy()
  expect(screen.queryByRole('button', { name: /锐历|Nutrinet/ })).toBeNull()
})

it('imports a conversation and draft only from the configured opener, without sending a request', async () => {
  const opener = { postMessage: vi.fn() }
  vi.stubGlobal('opener', opener)
  window.history.replaceState(null, '', '/ai?from=https%3A%2F%2Fjaxson.bond%2F&handoff=example-token')
  const request = vi.fn()
  stubFetch(request)
  const state = { messages: [
    { id: 'u-1', role: 'user', content: '原来的问题', createdAt: '2026-10-28T08:00:00Z' },
    { id: 'a-1', role: 'assistant', content: '原来的回答', replyTo: 'u-1', status: 'completed', evidence: ['公开资料'] },
  ], draft: '继续追问的草稿' }
  render(React.createElement(AIPage))
  const dispatch = (origin: string, source: unknown, snapshot = state) => act(() => {
    window.dispatchEvent(new MessageEvent('message', { origin, source: source as Window, data: { type: 'jaxson-chat:state', token: 'example-token', state: snapshot } }))
  })
  dispatch('https://untrusted.example', opener)
  dispatch('https://jaxson.bond', {})
  expect(screen.queryByText('原来的问题')).toBeNull()
  dispatch('https://jaxson.bond', opener)
  expect(screen.getByText('原来的问题')).toBeTruthy()
  expect(screen.getByText('原来的回答')).toBeTruthy()
  expect((screen.getByRole('textbox', { name: '问我的 AI 分身' }) as HTMLTextAreaElement).value).toBe('继续追问的草稿')
  expect(request).not.toHaveBeenCalled()
  expect(window.location.search).not.toContain('handoff')
  dispatch('https://jaxson.bond', opener, { ...state, draft: '不应覆盖' })
  expect((screen.getByRole('textbox', { name: '问我的 AI 分身' }) as HTMLTextAreaElement).value).toBe('继续追问的草稿')
  window.history.replaceState(null, '', '/')
})

function send(question: string) {
  fireEvent.change(screen.getByPlaceholderText('向 AI 分身提问，或直接粘贴贵司岗位 JD 需求...'), { target: { value: question } })
  fireEvent.click(screen.getByRole('button', { name: '发送消息' }))
}

it('answers an ordinary internship role question without switching to JD matching', async () => {
  const request = vi.fn().mockResolvedValue(new Response(event('text', { text: '开发实习生。' }) + event('done', {})))
  stubFetch(request)
  render(React.createElement(AIPage))
  send('你的实习岗位是什么？')
  await screen.findByText('开发实习生。')
  expect(JSON.parse(request.mock.calls[0][1].body).isJdMatch).toBe(false)
  expect(screen.queryByText('岗位匹配')).toBeNull()
})

it('accepts multiline JD input, keeps Shift+Enter and IME Enter, and sends on Enter', async () => {
  const request = vi.fn().mockResolvedValue(new Response(event('text', { text: '匹配结果' }) + event('done', {})))
  stubFetch(request)
  render(React.createElement(AIPage))
  const field = screen.getByRole('textbox', { name: '问我的 AI 分身' }) as HTMLTextAreaElement
  expect(field.tagName).toBe('TEXTAREA')
  const jd = '请匹配这个 JD\n岗位职责：开发应用\n任职要求：React、TypeScript'
  fireEvent.change(field, { target: { value: jd } })
  fireEvent.keyDown(field, { key: 'Enter', shiftKey: true })
  fireEvent.keyDown(field, { key: 'Enter', isComposing: true })
  expect(request).not.toHaveBeenCalled()
  fireEvent.keyDown(field, { key: 'Enter' })
  await screen.findByText('匹配结果')
  expect(JSON.parse(request.mock.calls[0][1].body)).toMatchObject({ isJdMatch: true, messages: [{ role: 'user', content: jd }] })
})

it('times out a request before headers and keeps the next draft', async () => {
  vi.useFakeTimers()
  const request = vi.fn((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
  }))
  stubFetch(request)
  render(React.createElement(AIPage))
  send('等待的问题')
  fireEvent.change(screen.getByRole('textbox', { name: '问我的 AI 分身' }), { target: { value: '下一条草稿' } })
  await act(async () => { await vi.advanceTimersByTimeAsync(12000) })
  expect(screen.getByText(/等待时间较长/)).toBeTruthy()
  await act(async () => { await vi.advanceTimersByTimeAsync(33000) })
  expect(screen.getByText(/等待回答超时/)).toBeTruthy()
  expect(screen.getByRole('button', { name: '重试回答' })).toBeTruthy()
  expect((screen.getByRole('textbox', { name: '问我的 AI 分身' }) as HTMLTextAreaElement).value).toBe('下一条草稿')
})

it('resets the idle deadline on progress and retains the partial answer on a later timeout', async () => {
  vi.useFakeTimers()
  let controller!: ReadableStreamDefaultController<Uint8Array>
  stubFetch(() => Promise.resolve(new Response(new ReadableStream<Uint8Array>({ start(value) { controller = value } }))))
  render(React.createElement(AIPage))
  send('持续输出的问题')
  await act(async () => { await vi.advanceTimersByTimeAsync(40000) })
  await act(async () => { controller.enqueue(encoder.encode(event('text', { text: '已经收到的内容' }))) })
  expect(screen.queryByText(/等待时间较长/)).toBeNull()
  await act(async () => { await vi.advanceTimersByTimeAsync(44000) })
  expect(screen.getByRole('button', { name: '停止生成' })).toBeTruthy()
  await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
  expect(screen.getByText('已经收到的内容')).toBeTruthy()
  expect(screen.getByText(/回答长时间未更新/)).toBeTruthy()
  expect(screen.getByRole('button', { name: '重试回答' })).toBeTruthy()
})

it('keeps a partial answer on transport failure and offers retry for the same question', async () => {
  let controller!: ReadableStreamDefaultController<Uint8Array>
  const stream = new ReadableStream<Uint8Array>({ start(value) { controller = value } })
  const request = vi.fn().mockResolvedValueOnce(new Response(stream)).mockResolvedValueOnce(new Response(
    event('text', { text: '重试后的完整答案' }) + event('done', {}),
  ))
  stubFetch(request)
  render(React.createElement(AIPage))
  send('同一个问题')
  await act(async () => { controller.enqueue(encoder.encode(event('text', { text: '已收到的部分答案' }))) })
  expect(await screen.findByText('已收到的部分答案')).toBeTruthy()
  await act(async () => { controller.error(new Error('connection lost')) })
  expect(screen.getByText('已收到的部分答案')).toBeTruthy()
  fireEvent.click(await screen.findByRole('button', { name: '重试回答' }))
  expect(await screen.findByText('重试后的完整答案')).toBeTruthy()
  expect(screen.getAllByText('同一个问题')).toHaveLength(1)
  const retried = JSON.parse(request.mock.calls[1][1].body)
  expect(retried.messages).toEqual([{ role: 'user', content: '同一个问题' }])
})

it('treats EOF without done as interruption and excludes that round from the next request', async () => {
  const request = vi.fn()
    .mockResolvedValueOnce(new Response(event('text', { text: '不完整的答案' })))
    .mockResolvedValueOnce(new Response(event('text', { text: '第二个答案' }) + event('done', {})))
  stubFetch(request)
  render(React.createElement(AIPage))
  send('中断的问题')
  expect(await screen.findByRole('button', { name: '重试回答' })).toBeTruthy()
  send('新的问题')
  expect(await screen.findByText('第二个答案')).toBeTruthy()
  expect(JSON.parse(request.mock.calls[1][1].body).messages).toEqual([{ role: 'user', content: '新的问题' }])
})

it('keeps the current question within all server budgets after six long completed rounds', async () => {
  const request = vi.fn().mockImplementation(async () => new Response(
    event('text', { text: '长'.repeat(3000) }) + event('done', {}),
  ))
  stubFetch(request)
  render(React.createElement(AIPage))
  for (let round = 1; round <= 6; round++) {
    send(`第${round}个问题`)
    await waitFor(() => expect(screen.queryByRole('button', { name: '停止生成' })).toBeNull())
  }
  const history = JSON.parse(request.mock.calls[5][1].body).messages as { role: string; content: string }[]
  expect(history.length).toBeLessThanOrEqual(10)
  expect(history.every((message) => message.content.length <= 2500)).toBe(true)
  expect(history.reduce((sum, message) => sum + message.content.length, 0)).toBeLessThanOrEqual(8000)
  expect(history.at(-1)).toEqual({ role: 'user', content: '第6个问题' })
  expect(history[0].role).toBe('user')
})

it('aborts a pending request on reset and ignores its late stream data', async () => {
  let controller!: ReadableStreamDefaultController<Uint8Array>
  const stream = new ReadableStream<Uint8Array>({ start(value) { controller = value } })
  const request = vi.fn().mockResolvedValue(new Response(stream))
  stubFetch(request)
  render(React.createElement(AIPage))
  send('旧会话问题')
  await waitFor(() => expect(request).toHaveBeenCalledOnce())
  fireEvent.click(screen.getByRole('button', { name: '清空记录' }))
  expect(request.mock.calls[0][1].signal?.aborted).toBe(true)
  await act(async () => {
    // A transport may still deliver a buffered frame after cancellation.
    try { controller.enqueue(encoder.encode(event('text', { text: '旧会话回答' }))) } catch { /* Body was cancelled. */ }
  })
  expect(screen.queryByText('旧会话回答')).toBeNull()
  expect(screen.queryByText('旧会话问题')).toBeNull()
})

it('shows [n] citations in an answer as numbered marks matching the numbered sources', async () => {
  stubFetch(() => Promise.resolve(new Response(encoder.encode(
    event('meta', { evidence: ['项目档案：待办备忘', '广东润喵云科技 · 开发实习生'], generator: 'external' }) +
    event('text', { text: '我做过待办备忘[1]，也实习过[2]。' }) + event('done', {}),
  ))))
  render(React.createElement(AIPage))
  send('你做过什么？')
  const marks = await screen.findAllByText(/^[12]$/, { selector: 'sup' })
  expect(marks.map((mark) => mark.textContent)).toEqual(['1', '2'])
  expect(screen.queryByText(/\[1\]/)).toBeNull()
  expect(screen.getByText('1. 项目档案：待办备忘')).toBeTruthy()
})

it('lists only the sources the answer cites, keeping their numbers', async () => {
  stubFetch(() => Promise.resolve(new Response(encoder.encode(
    event('meta', { evidence: ['项目档案：待办备忘', '没被引用的资料', '广东润喵云科技 · 开发实习生'], generator: 'external' }) +
    event('text', { text: '我做过待办备忘[1]，也实习过[3]。' }) + event('done', {}),
  ))))
  render(React.createElement(AIPage))
  send('你做过什么？')
  await screen.findByText('3. 广东润喵云科技 · 开发实习生')
  expect(screen.getByText('1. 项目档案：待办备忘')).toBeTruthy()
  expect(screen.queryByText(/没被引用的资料/)).toBeNull()
})

it('stops a partial answer, keeps the next draft and excludes the stopped round from history', async () => {
  let controller!: ReadableStreamDefaultController<Uint8Array>
  const request = vi.fn()
    .mockResolvedValueOnce(new Response(new ReadableStream<Uint8Array>({ start(value) { controller = value } })))
    .mockResolvedValueOnce(new Response(event('text', { text: '新问题的回答' }) + event('done', {})))
  stubFetch(request)
  render(React.createElement(AIPage))
  send('待停止的问题')
  await act(async () => { controller.enqueue(encoder.encode(event('text', { text: '已经收到的内容' }))) })
  const field = screen.getByPlaceholderText('向 AI 分身提问，或直接粘贴贵司岗位 JD 需求...') as HTMLInputElement
  expect(field.disabled).toBe(false)
  fireEvent.change(field, { target: { value: '下一条草稿' } })
  fireEvent.click(screen.getByRole('button', { name: '停止生成' }))
  expect(request.mock.calls[0][1].signal.aborted).toBe(true)
  expect(await screen.findByText(/已停止生成/)).toBeTruthy()
  expect(screen.getByText('已经收到的内容')).toBeTruthy()
  expect(field.value).toBe('下一条草稿')
  fireEvent.click(screen.getByRole('button', { name: '发送消息' }))
  expect(await screen.findByText('新问题的回答')).toBeTruthy()
  expect(JSON.parse(request.mock.calls[1][1].body).messages).toEqual([{ role: 'user', content: '下一条草稿' }])
})

it('retrying an older failed question replaces later messages while preserving the composer draft', async () => {
  const request = vi.fn()
    .mockResolvedValueOnce(new Response('', { status: 503 }))
    .mockResolvedValueOnce(new Response(event('text', { text: '后续回答' }) + event('done', {})))
    .mockResolvedValueOnce(new Response(event('text', { text: '修复后的回答' }) + event('done', {})))
  stubFetch(request)
  render(React.createElement(AIPage))
  send('失败的问题')
  await screen.findByRole('button', { name: '重试回答' })
  send('后续问题')
  await screen.findByText('后续回答')
  const field = screen.getByPlaceholderText('向 AI 分身提问，或直接粘贴贵司岗位 JD 需求...') as HTMLInputElement
  fireEvent.change(field, { target: { value: '保留草稿' } })
  fireEvent.click(screen.getByRole('button', { name: '重试回答' }))
  await screen.findByText('修复后的回答')
  expect(screen.queryByText('后续问题')).toBeNull()
  expect(screen.queryByText('后续回答')).toBeNull()
  expect(field.value).toBe('保留草稿')
  expect(JSON.parse(request.mock.calls[2][1].body).messages).toEqual([{ role: 'user', content: '失败的问题' }])
})

it('retains structured project sources and links them to their details', async () => {
  stubFetch(() => Promise.resolve(new Response(
    event('meta', { evidence: ['项目档案：待办备忘', '公开经历'], sources: [{ tag: '项目档案：待办备忘', project: 'todo-memo' }, { tag: '公开经历' }], generator: 'external' }) +
    event('text', { text: '查看项目[1]。' }) + event('done', {}),
  )))
  render(React.createElement(AIPage))
  send('介绍项目')
  const source = await screen.findByRole('link', { name: '1. 项目档案：待办备忘' })
  expect(source.getAttribute('href')).toBe('/projects/todo-memo')
  expect(source.getAttribute('target')).toBe('_blank')
  expect(screen.queryByText('2. 公开经历')).toBeNull()
})

it('explains rate limiting without reporting a generic network failure', async () => {
  stubFetch(() => Promise.resolve(new Response('', { status: 429 })))
  render(React.createElement(AIPage))
  send('介绍实习')
  expect(await screen.findByText(/提问太频繁/)).toBeTruthy()
  expect(screen.queryByText('暂时未能生成回答，请重试。')).toBeNull()
})

it.each([false, true])('copies an answer and reports clipboard failure=%s without changing the message', async (fails) => {
  const writeText = fails ? vi.fn().mockRejectedValue(new Error('denied')) : vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  stubFetch(() => Promise.resolve(new Response(event('text', { text: '**公开答案** [1]' }) + event('done', {}))))
  render(React.createElement(AIPage))
  send('原问题')
  await screen.findByText('公开答案')
  fireEvent.click(screen.getByRole('button', { name: '复制回答' }))
  expect(await screen.findByText(fails ? '复制失败，请手动选择文字' : '已复制')).toBeTruthy()
  expect(writeText).toHaveBeenCalledWith('**公开答案** [1]')
  expect(screen.getByText('公开答案')).toBeTruthy()
})

it('regenerates a completed answer in the same round and preserves the next question draft', async () => {
  const request = vi.fn().mockImplementation(() => Promise.resolve(new Response(event('text', { text: '完整答案' }) + event('done', {}))))
  stubFetch(request)
  render(React.createElement(AIPage))
  send('原问题')
  await screen.findByText('完整答案')
  const field = screen.getByRole('textbox', { name: '问我的 AI 分身' }) as HTMLInputElement
  fireEvent.change(field, { target: { value: '保留这个草稿' } })
  fireEvent.click(screen.getByRole('button', { name: '重新生成回答' }))
  await waitFor(() => expect(request).toHaveBeenCalledTimes(2))
  await screen.findByRole('button', { name: '重新生成回答' })
  expect(screen.getAllByText('原问题')).toHaveLength(1)
  expect(field.value).toBe('保留这个草稿')
  expect(JSON.parse(request.mock.calls[1][1].body).messages).toEqual([{ role: 'user', content: '原问题' }])
})

it('cancels question editing without changes, then sends the edited branch while keeping the composer draft', async () => {
  const request = vi.fn().mockImplementation(() => Promise.resolve(new Response(event('text', { text: '完整答案' }) + event('done', {}))))
  stubFetch(request)
  render(React.createElement(AIPage))
  send('原问题')
  await screen.findByRole('button', { name: '重新生成回答' })
  send('后续问题')
  await waitFor(() => expect(screen.getAllByRole('button', { name: '重新生成回答' })).toHaveLength(2))
  const field = screen.getByRole('textbox', { name: '问我的 AI 分身' }) as HTMLInputElement
  fireEvent.change(field, { target: { value: '底部草稿' } })
  fireEvent.click(screen.getAllByRole('button', { name: '编辑问题' })[0])
  const editor = screen.getByRole('textbox', { name: '编辑问题' })
  fireEvent.change(editor, { target: { value: '暂时修改' } })
  fireEvent.click(screen.getByRole('button', { name: /^取消$/ }))
  expect(screen.getByText('原问题')).toBeTruthy()
  expect(field.value).toBe('底部草稿')
  expect(document.activeElement?.getAttribute('aria-label')).toBe('编辑问题')
  fireEvent.click(screen.getAllByRole('button', { name: '编辑问题' })[0])
  fireEvent.change(screen.getByRole('textbox', { name: '编辑问题' }), { target: { value: '修改后的问题' } })
  fireEvent.click(screen.getByRole('button', { name: /^发送$/ }))
  await waitFor(() => expect(request).toHaveBeenCalledTimes(3))
  expect(screen.queryByText('原问题')).toBeNull()
  expect(screen.queryByText('后续问题')).toBeNull()
  expect(screen.getByText('修改后的问题')).toBeTruthy()
  expect(field.value).toBe('底部草稿')
  expect(JSON.parse(request.mock.calls[2][1].body).messages).toEqual([{ role: 'user', content: '修改后的问题' }])
})
