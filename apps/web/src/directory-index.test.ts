import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath, URL as NodeUrl } from 'node:url'
import { describe, expect, it } from 'vitest'

// docs/目录索引.md is where people (and agents) look before opening files. Every module, content type,
// API route and script must be listed there, so the index cannot quietly fall behind the code.
const root = fileURLToPath(new NodeUrl('../../../', import.meta.url))
const index = readFileSync(join(root, 'docs', '目录索引.md'), 'utf8')
const path = (absolute: string) => relative(root, absolute).replaceAll('\\', '/')
const entries = (directory: string) => readdirSync(join(root, directory)).map((name) => join(root, directory, name))
const isDirectory = (absolute: string) => statSync(absolute).isDirectory()
const isSource = (absolute: string) => !isDirectory(absolute) && !/\.(test|spec)\.|\.d\.mts$|\.md$/.test(absolute)

const watched = [
  ...entries('apps/web/src/features').filter(isDirectory).map((absolute) => `${path(absolute)}/`),
  'apps/web/src/features/ai/rag/',
  ...entries('apps/web/src/app/api').filter(isDirectory).map((absolute) => `${path(absolute)}/`),
  ...entries('apps/web/src/collections').filter(isSource).map(path),
  ...entries('apps/web/scripts').filter(isSource).map(path),
  ...entries('apps/web/scripts/lib').filter(isSource).map(path),
  ...entries('apps/portfolio/scripts').filter(isSource).map(path),
  ...entries('docker').filter((absolute) => isSource(absolute) && /\.(sh|py|mjs)$/.test(absolute)).map(path),
]

describe('docs/目录索引.md', () => {
  it('lists every module, API route, content type and script', () => {
    const missing = watched.filter((entry) => !index.includes(`\`${entry}\``))
    expect(missing, '在 docs/目录索引.md 中补上这些路径').toEqual([])
  })

  it('does not list paths that no longer exist', () => {
    const listed = [...index.matchAll(/`((?:apps|docker|integrations|docs|scripts|infra)\/[^`*]+)`/g)].map((match) => match[1])
    const gone = listed.filter((entry) => {
      try { statSync(join(root, entry)); return false } catch { return true }
    })
    expect(gone, '从 docs/目录索引.md 中删掉或改正这些路径').toEqual([])
  })
})
