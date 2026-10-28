import { expect, it, vi } from 'vitest'
import { checkPublicHealth } from '../../../scripts/check-public-health.mjs'
import { readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import path from 'node:path'
const stream = (body: string) => new Response(body, { headers: { 'content-type': 'text/event-stream' } })
const page = () => new Response('<html></html>', { headers: { 'content-type': 'text/html' } })
it('requires a real text event and a completed stream, not just an HTTP 200 response', async () => {
  for (const body of ['event: done\ndata: {}\n\n', 'event: text\ndata: {"text":"partial"}\n\n', 'event: error\ndata: {}\n\n']) {
    await expect(checkPublicHealth(undefined, vi.fn().mockResolvedValueOnce(page()).mockResolvedValueOnce(stream(body)))).rejects.toThrow()
  }
  await expect(checkPublicHealth(undefined, vi.fn().mockResolvedValueOnce(page()).mockResolvedValueOnce(stream('event: text\r\ndata: {"text":"ok"}\r\n\r\nevent: done\r\ndata: {}\r\n\r\n')))).resolves.toBeUndefined()
})

it('runs from stdin in a previous runtime image that does not contain the new health script', async () => {
  let requests = 0
  const server = createServer((request, response) => {
    requests++
    response.setHeader('content-type', request.url === '/ai' ? 'text/html' : 'text/event-stream')
    response.end(request.url === '/ai' ? '<html></html>' : 'event: text\ndata: {"text":"ok"}\n\nevent: done\ndata: {}\n\n')
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    const address = server.address() as { port: number }
    const source = await readFile(path.resolve('scripts/check-public-health.mjs'), 'utf8')
    const child = spawn(process.execPath, ['--input-type=module', '-'], {
      env: { ...process.env, PUBLIC_HEALTH_ORIGIN: `http://127.0.0.1:${address.port}` },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    const completed = new Promise<number | null>((resolve, reject) => { child.once('exit', resolve); child.once('error', reject) })
    child.stdin.end(source)
    expect(await completed).toBe(0)
    expect(requests).toBe(2)
  } finally { await new Promise<void>(resolve => server.close(() => resolve())) }
})
