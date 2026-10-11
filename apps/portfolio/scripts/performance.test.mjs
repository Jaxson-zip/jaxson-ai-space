import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

test('first-screen local images fit a 750 KiB cold-load budget', async () => {
  const html = await readFile(resolve(root, 'index.html'), 'utf8')
  const hero = html.match(/<img\s[^>]*id="heroAvatarImg"[^>]*>/)?.[0]
  assert.ok(hero, 'hero image exists')
  const portrait = hero.match(/src="\.\/([^"]+)"/)[1]
  const walls = [...html.matchAll(/url\('\.\/([^']+\.webp)'\)/g)].map(match => match[1])
  const wallBytes = walls.length ? Math.max(...await Promise.all(walls.map(async path =>
    (await stat(resolve(root, 'public', path))).size))) :
    (await stat(resolve(root, 'public', 'jaxson_studio_wall_plate_v2.png'))).size
  const bytes = (await stat(resolve(root, 'public', portrait))).size +
    wallBytes
  assert.ok(bytes < 750 * 1024, `first-screen images are ${bytes} bytes`)
})

test('first paint has no third-party font stylesheet dependency', async () => {
  const html = await readFile(resolve(root, 'index.html'), 'utf8')
  const externalStylesheets = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)]
    .filter(([tag]) => /href="https?:\/\//.test(tag))
  assert.equal(externalStylesheets.length, 0, 'external stylesheets delay first paint')
})
