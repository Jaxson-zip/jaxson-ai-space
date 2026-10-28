import { createServer } from 'node:http'
import { createReadStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { dirname, extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { browserConfig } from './config.mjs'
import { createShowcaseFeed } from './showcase.mjs'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const production = process.argv.includes('--production')
const files = production ? resolve(root, 'dist') : resolve(root, 'public')
const port = Number(process.env.PORT || 3000)
const host = process.env.HOST || '127.0.0.1'
const serveShowcase = createShowcaseFeed()
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
}

createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD', 'Cache-Control': 'no-store' }).end()
    return
  }
  try {
    const pathname = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`).pathname
    if (pathname === '/api/showcase-projects') {
      await serveShowcase(request, response)
      return
    }
    if (pathname === '/portfolio/jaxson_biaoge_restart.html') {
      response.writeHead(307, { Location: '/' }).end()
      return
    }
    if (pathname === '/config.js' && !production) {
      const body = browserConfig()
      response.writeHead(200, { 'Content-Type': mime['.js'], 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(body) })
      response.end(request.method === 'HEAD' ? undefined : body)
      return
    }
    const file = pathname === '/' || pathname === '/index.html'
      ? resolve(root, production ? 'dist/index.html' : 'index.html')
      : resolve(files, `.${decodeURIComponent(pathname)}`)
    const allowedRoot = pathname === '/' || pathname === '/index.html' ? resolve(root, production ? 'dist' : '.') : files
    if (!file.startsWith(allowedRoot + sep)) {
      response.writeHead(403).end()
      return
    }
    const info = await stat(file)
    if (!info.isFile()) throw new Error('Not a file')
    // The home page is checked on every visit; Cloudflare's edge may keep it two minutes, so visitors skip
    // the trip through the tunnel and a release shows within two minutes. The résumé PDF is never kept.
    const homePage = pathname === '/' || pathname === '/index.html' || pathname === '/config.js'
    const resume = pathname.startsWith('/resume/')
    const versionedAsset = /\.[a-f0-9]{12}\.(webp|woff2)$/.test(pathname)
    const etag = `W/"${info.size.toString(16)}-${Math.trunc(info.mtimeMs).toString(16)}"`
    const headers = {
      'Content-Type': mime[extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': info.size,
      'Cache-Control': !production || resume ? 'no-store' : homePage ? 'public, max-age=0, must-revalidate'
        : versionedAsset ? 'public, max-age=31536000, immutable' : 'public, max-age=3600',
      ETag: etag,
    }
    if (production && homePage) headers['CDN-Cache-Control'] = 'max-age=120'
    const ifNoneMatch = request.headers['if-none-match']
    if (!resume && ifNoneMatch?.split(',').some(value =>
      value.trim() === '*' || value.trim().replace(/^W\//, '') === etag.replace(/^W\//, ''))) {
      delete headers['Content-Length']
      response.writeHead(304, headers).end()
      return
    }
    const video = headers['Content-Type'].startsWith('video/')
    if (video) headers['Accept-Ranges'] = 'bytes'
    const ifRange = request.headers['if-range']
    const rangeMatches = !ifRange || (!ifRange.includes('"') && Number.isFinite(Date.parse(ifRange)) &&
      Math.trunc(info.mtimeMs / 1000) <= Math.trunc(Date.parse(ifRange) / 1000))
    const range = request.headers.range
    if (video && request.method === 'GET' && range?.startsWith('bytes=') && rangeMatches) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range)
      let start = match?.[1] ? Number(match[1]) : 0
      let end = match?.[2] ? Number(match[2]) : info.size - 1
      if (match && !match[1] && match[2]) {
        start = Math.max(0, info.size - Number(match[2]))
        end = info.size - 1
      }
      if (!match || (!match[1] && !match[2]) || (!match[1] && Number(match[2]) === 0) ||
        !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= info.size || end < start) {
        response.writeHead(416, { ...headers, 'Content-Length': 0, 'Content-Range': `bytes */${info.size}` }).end()
        return
      }
      end = Math.min(end, info.size - 1)
      response.writeHead(206, { ...headers, 'Content-Length': end - start + 1, 'Content-Range': `bytes ${start}-${end}/${info.size}` })
      createReadStream(file, { start, end }).on('error', () => response.destroy()).pipe(response)
      return
    }
    response.writeHead(200, headers)
    if (request.method === 'HEAD') response.end()
    else createReadStream(file).on('error', () => response.destroy()).pipe(response)
  } catch {
    // Unknown addresses get the styled 404 page; plain text only if that page itself is missing.
    const page = await readFile(resolve(files, '404.html')).catch(() => null)
    if (page) response.writeHead(404, { 'Content-Type': mime['.html'], 'Cache-Control': 'no-store' }).end(request.method === 'HEAD' ? undefined : page)
    else response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }).end('Not found')
  }
}).listen(port, host, () => {
  console.log(`Portfolio listening at http://${host}:${port} (${production ? 'dist' : 'source'})`)
})
