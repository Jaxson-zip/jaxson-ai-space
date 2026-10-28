import { pathToFileURL } from 'node:url'

/** A complete bounded chat round, without printing prompts, answers or credentials. */
export async function checkPublicHealth(origin = 'http://127.0.0.1:3000', fetcher = fetch) {
  const signal = AbortSignal.timeout(45000)
  const page = await fetcher(new URL('/ai', origin), { signal, redirect: 'error' })
  if (!page.ok || !page.headers.get('content-type')?.includes('text/html')) throw new Error('AI page unavailable')
  await page.body?.cancel()
  const response = await fetcher(new URL('/api/chat', origin), {
    signal, redirect: 'error', method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: '有哪些公开项目？请一句话回答。' }] }),
  })
  if (!response.ok || !response.body || !response.headers.get('content-type')?.includes('text/event-stream')) throw new Error('Chat stream unavailable')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = '', bytes = 0, hasText = false
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) throw new Error('Chat did not complete')
      bytes += value.byteLength
      if (bytes > 131072) throw new Error('Chat health response exceeds budget')
      buffer = (buffer + decoder.decode(value, { stream: true })).replace(/\r\n/g, '\n')
      let end
      while ((end = buffer.indexOf('\n\n')) >= 0) {
        const block = buffer.slice(0, end)
        buffer = buffer.slice(end + 2)
        const type = /^event: (.+)$/m.exec(block)?.[1]
        const data = block.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n')
        if (type === 'error') throw new Error('Chat reported an error')
        if (type === 'text' && data && typeof JSON.parse(data).text === 'string' && JSON.parse(data).text.trim()) hasText = true
        if (type === 'done') { if (!hasText) throw new Error('Chat returned no answer'); return }
      }
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
}

// The release tool also pipes this into the previous image during rollback.
if (process.argv[1] === '-' || (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)) {
  checkPublicHealth(process.env.PUBLIC_HEALTH_ORIGIN).then(() => console.log('Public AI page and chat stream healthy'))
    .catch(() => { console.error('Public AI health check failed'); process.exitCode = 1 })
}
