import { backendOrigin } from './config.mjs'

// This feed has one fixed, anonymous upstream. Never forward browser credentials
// or query parameters to the CMS, and never proxy arbitrary API paths.
export function createShowcaseFeed() {
  const publicOrigin = new URL(backendOrigin())
  const upstreamOrigin = new URL(process.env.PORTFOLIO_UPSTREAM_ORIGIN || publicOrigin)
  if (!['http:', 'https:'].includes(upstreamOrigin.protocol) || upstreamOrigin.username ||
      upstreamOrigin.password || upstreamOrigin.pathname !== '/' || upstreamOrigin.search || upstreamOrigin.hash) {
    throw new Error('PORTFOLIO_UPSTREAM_ORIGIN must be an HTTP(S) origin without credentials or a path')
  }
  const endpoint = new URL('/api/showcase-projects', upstreamOrigin)
  const ttl = Number(process.env.PORTFOLIO_PROJECT_CACHE_MS ?? 10000)
  if (!Number.isInteger(ttl) || ttl < 0 || ttl > 10000) {
    throw new Error('PORTFOLIO_PROJECT_CACHE_MS must be between 0 and 10000')
  }
  let cached = null
  let pending = null

  async function loadFeed() {
    const startedAt = Date.now()
    const upstream = await fetch(endpoint, {
      headers: { Accept: 'application/json' }, redirect: 'error',
      signal: AbortSignal.timeout(5000),
    })
    if (!upstream.ok || !upstream.body) throw new Error('CMS unavailable')
    const reader = upstream.body.getReader()
    const chunks = []
    let bytes = 0
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        bytes += value.byteLength
        if (bytes > 2 * 1024 * 1024) throw new Error('Public feed too large')
        chunks.push(value)
      }
    } finally {
      await reader.cancel().catch(() => {})
      reader.releaseLock()
    }
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (data.source !== 'cms' || !Array.isArray(data.projects)) throw new Error('Invalid public feed')
    // Relative media links generated on the Docker network must stay public.
    for (const project of data.projects) {
      for (const key of ['image', 'video']) {
        if (typeof project[key] !== 'string' || !/^https?:\/\//.test(project[key])) continue
        const media = new URL(project[key])
        if (media.host === upstreamOrigin.host || media.host === publicOrigin.host) {
          media.protocol = publicOrigin.protocol
          media.host = publicOrigin.host
          project[key] = media.href
        }
      }
    }
    const body = JSON.stringify({ source: 'cms', projects: data.projects })
    cached = { body, expires: startedAt + ttl }
    return body
  }

  return async function serveShowcase(request, response) {
    try {
      const body = cached && Date.now() < cached.expires ? cached.body :
        await (pending ??= loadFeed().finally(() => { pending = null }))
      response.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
        'Content-Length': Buffer.byteLength(body),
      })
      response.end(request.method === 'HEAD' ? undefined : body)
    } catch {
      cached = null
      response.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
      response.end(request.method === 'HEAD' ? undefined : JSON.stringify({ error: 'Project data is temporarily unavailable' }))
    }
  }
}
