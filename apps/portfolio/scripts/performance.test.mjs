import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

test('first-screen local images fit a 750 KiB cold-load budget', async () => {
  const html = await readFile(resolve(root, 'index.html'), 'utf8')
  const hero = html.match(/<section class="hero"[\s\S]*?<\/section>\s*<section/)?.[0]
  assert.ok(hero?.includes('id="heroAvatarImg"'), 'hero section with portrait exists')
  // Every eagerly loaded image in the first screen, plus any image the stylesheet paints.
  const images = [...hero.matchAll(/<img\s[^>]*>/g)].map(([tag]) => tag).filter(tag => !/loading="lazy"/.test(tag))
    .map(tag => tag.match(/src="\.\/([^"]+)"/)[1])
  const painted = [...html.matchAll(/url\('\.\/([^']+\.(?:webp|png|jpe?g))'\)/g)].map(match => match[1])
  const sizes = await Promise.all([...new Set([...images, ...painted])].map(async path => (await stat(resolve(root, 'public', path))).size))
  const bytes = sizes.reduce((sum, size) => sum + size, 0)
  assert.ok(images.length >= 1, 'first-screen images found')
  assert.ok(bytes < 750 * 1024, `first-screen images are ${bytes} bytes`)
})

test('first paint has no third-party font stylesheet dependency', async () => {
  const html = await readFile(resolve(root, 'index.html'), 'utf8')
  const externalStylesheets = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)]
    .filter(([tag]) => /href="https?:\/\//.test(tag))
  assert.equal(externalStylesheets.length, 0, 'external stylesheets delay first paint')
})
