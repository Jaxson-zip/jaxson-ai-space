import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { createServer } from 'node:net'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { once } from 'node:events'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

test('repeat asset requests return 304 without bytes; entry pages remain fresh', async t => {
  const build = spawnSync(process.execPath, [resolve(root, 'scripts/build.mjs')])
  assert.equal(build.status, 0)
  const reservation = createServer().listen(0, '127.0.0.1')
  await once(reservation, 'listening')
  const port = reservation.address().port
  await new Promise(resolve => reservation.close(resolve))
  const child = spawn(process.execPath, [resolve(root, 'scripts/serve.mjs'), '--production'], {
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe']
  })
  t.after(async () => { child.kill(); await once(child, 'exit') })
  await once(child.stdout, 'data')
  const origin = `http://127.0.0.1:${port}`
  const manifest = JSON.parse(await readFile(resolve(root, 'public/optimized/images.json'), 'utf8'))
  const path = manifest.jaxson_character_navy_v1[1].src.replace(/^\./, '')
  const first = await fetch(origin + path)
  assert.equal(first.status, 200)
  assert.equal(first.headers.get('content-type'), 'image/webp')
  assert.match(first.headers.get('cache-control'), /immutable/)
  const etag = first.headers.get('etag')
  assert.ok(etag)
  assert.equal((await first.arrayBuffer()).byteLength, manifest.jaxson_character_navy_v1[1].bytes)
  const repeat = await fetch(origin + path, { headers: { 'If-None-Match': etag } })
  assert.equal(repeat.status, 304)
  assert.equal((await repeat.arrayBuffer()).byteLength, 0)
  const head = await fetch(origin + path, { method: 'HEAD' })
  assert.equal(head.headers.get('etag'), etag)
  assert.equal((await head.arrayBuffer()).byteLength, 0)
  for (const page of ['/', '/index.html', '/config.js', '/resume/zhang-jinpeng-ai-product-builder.pdf']) {
    assert.equal((await fetch(origin + page)).headers.get('cache-control'), 'no-store')
  }
})
