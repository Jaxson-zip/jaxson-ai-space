import React from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import AIPage from '@/app/(frontend)/ai/page'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

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

function send(question: string) {
  fireEvent.change(screen.getByPlaceholderText('向 AI 分身提问，或直接粘贴贵司岗位 JD 需求...'), { target: { value: question } })
  fireEvent.click(screen.getByRole('button', { name: '发送消息' }))
}

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
    await waitFor(() => expect((screen.getByPlaceholderText('向 AI 分身提问，或直接粘贴贵司岗位 JD 需求...') as HTMLInputElement).disabled).toBe(false))
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
