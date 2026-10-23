import { afterEach, expect, it, vi } from 'vitest'
import { createRAGStream } from './llm-stream'

afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

const config = {
  messages: [{ id: 'question', role: 'user' as const, content: '请介绍这个项目' }],
  retrievalResults: [{
    chunk: { id: 'project', title: 'Published project', category: 'project' as const,
      content: 'A real published project', evidenceTag: 'CMS project', keywords: [] },
    score: 1, vectorScore: 1, bm25Score: 1,
  }],
}

const textEvent = 'data: {"choices":[{"delta":{"content":"已有答案"}}]}\n\n'
const encoder = new TextEncoder()

it('marks EOF without the provider completion sentinel as interrupted', async () => {
  vi.stubEnv('DEEPSEEK_API_KEY', 'test-only-key')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(textEvent)))
  const output = await new Response(await createRAGStream(config)).text()
  expect(output).toContain('已有答案')
  expect(output).toContain('event: error')
  expect(output).toContain('"code":"upstream_incomplete"')
  expect(output).not.toContain('event: done')
})

it('delivers a safe interruption event after retaining already streamed text', async () => {
  vi.stubEnv('DEEPSEEK_API_KEY', 'test-only-key')
  let upstreamController!: ReadableStreamDefaultController<Uint8Array>
  const upstream = new ReadableStream<Uint8Array>({ start(controller) { upstreamController = controller } })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(upstream)))
  const reader = (await createRAGStream(config)).getReader()
  const decoder = new TextDecoder()
  let output = decoder.decode((await reader.read()).value)
  upstreamController.enqueue(encoder.encode(textEvent))
  output += decoder.decode((await reader.read()).value)
  upstreamController.error(new Error('secret raw upstream failure'))
  while (true) {
    const item = await reader.read()
    if (item.done) break
    output += decoder.decode(item.value)
  }
  expect(output).toContain('已有答案')
  expect(output).toContain('event: error')
  expect(output).not.toContain('secret raw upstream failure')
  expect(output).not.toContain('event: done')
})

it('does not turn an already aborted request into a successful local answer', async () => {
  vi.stubEnv('DEEPSEEK_API_KEY', 'test-only-key')
  const abort = new AbortController()
  abort.abort()
  const request = vi.fn().mockRejectedValue(new DOMException('Cancelled', 'AbortError'))
  vi.stubGlobal('fetch', request)
  await expect(createRAGStream({ ...config, signal: abort.signal })).rejects.toMatchObject({ name: 'AbortError' })
  expect(request).not.toHaveBeenCalled()
})

it('cancels the upstream body when the downstream reader cancels', async () => {
  vi.stubEnv('DEEPSEEK_API_KEY', 'test-only-key')
  const cancelled = vi.fn()
  const upstream = new ReadableStream<Uint8Array>({ cancel: cancelled })
  let requestSignal: AbortSignal | undefined
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url, options) => {
    requestSignal = options.signal
    return new Response(upstream)
  }))
  const reader = (await createRAGStream(config)).getReader()
  await reader.read()
  await reader.cancel()
  expect(cancelled).toHaveBeenCalledOnce()
  expect(requestSignal?.aborted).toBe(true)
})

it('allows a progressing stream to exceed 20 seconds without a total request timeout', async () => {
  vi.useFakeTimers()
  // Native AbortSignal.timeout does not use the fake clock; make its timer observable.
  vi.spyOn(AbortSignal, 'timeout').mockImplementation((milliseconds) => {
    const abort = new AbortController()
    setTimeout(() => abort.abort(new DOMException('Timed out', 'TimeoutError')), milliseconds)
    return abort.signal
  })
  vi.stubEnv('DEEPSEEK_API_KEY', 'test-only-key')
  let upstreamController!: ReadableStreamDefaultController<Uint8Array>
  let requestSignal!: AbortSignal
  const upstream = new ReadableStream<Uint8Array>({ start(controller) { upstreamController = controller } })
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url, options) => {
    requestSignal = options.signal
    return new Response(upstream)
  }))
  const reader = (await createRAGStream(config)).getReader()
  await reader.read()
  for (let index = 0; index < 3; index++) {
    await vi.advanceTimersByTimeAsync(9000)
    upstreamController.enqueue(encoder.encode(textEvent))
    await reader.read()
  }
  expect(requestSignal.aborted).toBe(false)
  upstreamController.enqueue(encoder.encode('data: [DONE]\n\n'))
  expect(new TextDecoder().decode((await reader.read()).value)).toContain('event: done')
  await reader.cancel()
})

it('uses the selected DeepSeek model in non-thinking mode and identifies external generation in the stream', async () => {
  vi.stubEnv('DEEPSEEK_API_KEY', 'test-only-key')
  vi.stubEnv('DEEPSEEK_MODEL', 'verified-deepseek-model')
  const request = vi.fn().mockResolvedValue(new Response(
    'data: {"choices":[{"delta":{"content":"基于公开资料的回答"}}]}\n\ndata: [DONE]\n\n',
    { headers: { 'Content-Type': 'text/event-stream' } },
  ))
  vi.stubGlobal('fetch', request)
  const stream = await createRAGStream({
    messages: [{ id: 'question', role: 'user', content: '请介绍这个项目' }],
    retrievalResults: [{
      chunk: { id: 'project', title: 'Published project', category: 'project',
        content: 'A real published project', evidenceTag: 'CMS project', keywords: [] },
      score: 1, vectorScore: 1, bm25Score: 1,
    }],
  })
  const body = JSON.parse(request.mock.calls[0][1].body)
  expect(body.model).toBe('verified-deepseek-model')
  expect(body.thinking).toEqual({ type: 'disabled' })
  expect(body.max_tokens).toBe(1024)
  const output = await new Response(stream).text()
  expect(output).toContain('"generator":"external"')
  expect(output).toContain('"provider":"deepseek"')
  expect(output).toContain('基于公开资料的回答')
  expect(output).not.toContain('test-only-key')
})

it('answers from the retrieved facts when the model fails before saying anything', async () => {
  vi.stubEnv('DEEPSEEK_API_KEY', 'test-only-key')
  for (const upstream of [
    () => new Response(''), // ends at once
    () => new Response('data: [DONE]\n\n'), // completes empty
    () => new Response(new ReadableStream({ start(controller) { controller.error(new Error('reset')) } })), // drops
  ]) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream()))
    const output = await new Response(await createRAGStream(config)).text()
    expect(output).toContain('"generator":"local"')
    expect(output).toContain('A real published project')
    expect(output).toContain('event: done')
    expect(output).not.toContain('event: error')
  }
})

it('falls back to the facts when the first token never arrives', async () => {
  vi.useFakeTimers()
  vi.stubEnv('DEEPSEEK_API_KEY', 'test-only-key')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new ReadableStream())))
  const reader = (await createRAGStream(config)).getReader()
  const decoder = new TextDecoder()
  let output = ''
  const read = (async () => { while (true) { const item = await reader.read(); if (item.done) break; output += decoder.decode(item.value) } })()
  await vi.advanceTimersByTimeAsync(20001)
  await read
  expect(output).toContain('"generator":"local"')
  expect(output).toContain('event: done')
  expect(output).not.toContain('first_token_timeout')
})
