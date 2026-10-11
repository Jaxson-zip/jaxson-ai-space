import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

async function fixture(t) {
  const state = { requests: [], projects: [{ slug: 'published', title: 'Published project' }], status: 200 }
  const upstream = createServer((req, res) => {
    state.requests.push({ url: req.url, headers: req.headers })
    res.writeHead(state.status, { 'Content-Type': 'application/json', 'Set-Cookie': 'private-session=do-not-forward' })
    res.end(JSON.stringify({ source: 'cms', projects: state.projects }))
  }).listen(0, '127.0.0.1')
  await once(upstream, 'listening')
  t.after(() => new Promise(resolve => upstream.close(resolve)))
  const reservation = createServer().listen(0, '127.0.0.1')
  await once(reservation, 'listening')
  const port = reservation.address().port
  await new Promise(resolve => reservation.close(resolve))
  const child = spawn(process.execPath, [resolve(root, 'scripts/serve.mjs')], {
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port),
      PORTFOLIO_API_ORIGIN: 'https://cms.example.test',
      PORTFOLIO_UPSTREAM_ORIGIN: `http://127.0.0.1:${upstream.address().port}`,
      PORTFOLIO_PROJECT_CACHE_MS: '100' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  t.after(async () => { child.kill(); await once(child, 'exit') })
  await once(child.stdout, 'data')
  return { state, origin: `http://127.0.0.1:${port}` }
}

test('the portfolio exposes only the anonymous public project feed on its own origin', async t => {
  const { state, origin } = await fixture(t)
  const response = await fetch(`${origin}/api/showcase-projects?depth=99`, {
    headers: { Cookie: 'payload-token=admin-secret', Authorization: 'Bearer admin-secret' },
  })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { source: 'cms', projects: state.projects })
  assert.equal(response.headers.get('set-cookie'), null)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(state.requests[0].url, '/api/showcase-projects')
  assert.equal(state.requests[0].headers.cookie, undefined)
  assert.equal(state.requests[0].headers.authorization, undefined)
  assert.equal((await fetch(`${origin}/api/projects`)).status, 404)
  assert.equal((await fetch(`${origin}/api/showcase-projects`, { method: 'POST' })).status, 405)
})

test('concurrent readers share a bounded cache; withdrawals expire and failed refreshes never serve old projects', async t => {
  const { state, origin } = await fixture(t)
  const responses = await Promise.all(Array.from({ length: 5 }, () => fetch(`${origin}/api/showcase-projects`)))
  for (const response of responses) assert.equal(response.status, 200)
  assert.equal(state.requests.length, 1, 'concurrent readers should share one CMS read')
  state.projects = []
  await new Promise(resolve => setTimeout(resolve, 150))
  const withdrawn = await fetch(`${origin}/api/showcase-projects`)
  assert.deepEqual((await withdrawn.json()).projects, [], 'withdrawn projects must expire')
  assert.equal(state.requests.length, 2)
  state.status = 503
  await new Promise(resolve => setTimeout(resolve, 150))
  const failure = await fetch(`${origin}/api/showcase-projects`)
  assert.equal(failure.status, 503)
  assert.equal(failure.headers.get('cache-control'), 'no-store')
  assert.deepEqual(await failure.json(), { error: 'Project data is temporarily unavailable' })
  state.status = 200
  state.projects = [{ slug: 'newly-published', title: 'New project' }]
  const recovered = await fetch(`${origin}/api/showcase-projects`)
  assert.deepEqual((await recovered.json()).projects, state.projects, 'failures must not be cached')
})

test('uploaded cover URLs stay on the public CMS hostname and oversized feeds fail without retaining them', async t => {
  const { state, origin } = await fixture(t)
  // CMS URLs using its public host can still be generated as HTTP internally.
  state.projects = [{ slug: 'media', image: 'http://cms.example.test/media/cover.webp' }]
  const media = await fetch(`${origin}/api/showcase-projects`)
  assert.equal((await media.json()).projects[0].image, 'https://cms.example.test/media/cover.webp')
  await new Promise(resolve => setTimeout(resolve, 150))
  state.projects = [{ slug: 'oversized', summary: 'x'.repeat(2 * 1024 * 1024) }]
  assert.equal((await fetch(`${origin}/api/showcase-projects`)).status, 503)
  state.projects = []
  assert.deepEqual((await (await fetch(`${origin}/api/showcase-projects`)).json()).projects, [])
})
