import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { publishShizhang } from '../lib/shizhang_content.mjs'
const archive = JSON.parse(await readFile(new URL('../../docs/shizhang-content-draft.json', import.meta.url))).archive
function setup(initial = {}) {
  const docs = structuredClone({ projects: [], 'ai-knowledge': [], ...initial })
  const writes = []
  return { docs, writes, cms: {
    list: async collection => structuredClone(docs[collection]),
    write: async (collection, record) => {
      const doc = { ...structuredClone(record), id: 100 + writes.length }
      docs[collection].push(doc)
      writes.push({ collection, record })
      return doc
    },
  } }
}
test('plan performs no writes and only plans the two approved records', async () => {
  const fixture = setup()
  const result = await publishShizhang(fixture.cms, archive)
  assert.equal(result.plannedCreates, 2)
  assert.equal(fixture.writes.length, 0)
})
test('create goes through the CMS with non-featured order preserved, then retry is idempotent', async () => {
  const fixture = setup({ projects: [{ id: 1, slug: 'todo-memo', visibility: 'public', featured: true }] })
  const result = await publishShizhang(fixture.cms, archive, { apply: true })
  assert.equal(result.created.length, 2)
  assert.equal(result.verified.length, 2)
  assert.equal(fixture.writes[0].record.featured, false)
  assert.equal(fixture.writes[0].record.sortOrder, 30)
  const retry = await publishShizhang(fixture.cms, archive, { apply: true })
  assert.equal(retry.created.length, 0)
  assert.equal(retry.existing.length, 2)
  assert.equal(fixture.docs.projects[0].featured, true)
})
test('a collision in the second collection prevents the first write', async () => {
  const fixture = setup({ 'ai-knowledge': [{ ...archive.records['ai-knowledge'][0], id: 8, content: 'different' }] })
  await assert.rejects(publishShizhang(fixture.cms, archive, { apply: true }), /EXISTING_CONTENT_DIFFERS/)
  assert.equal(fixture.writes.length, 0)
})
test('a partial successful create can resume without overwriting existing data', async () => {
  const fixture = setup({ projects: [{ ...archive.records.projects[0], id: 10 }] })
  const result = await publishShizhang(fixture.cms, archive, { apply: true })
  assert.equal(result.existing.length, 1)
  assert.equal(result.created.length, 1)
  assert.equal(fixture.writes[0].collection, 'ai-knowledge')
})
test('rejects different slugs, private data, and new uploads before any write', async () => {
  for (const mutate of [
    a => { a.records.projects[0].slug = 'another-project' },
    a => { a.records.projects[0].visibility = 'private' },
    a => { a.records['ai-knowledge'][0].isPublic = false },
    a => { a.records.projects[0].demoUrl = 'https://private.example' },
    a => { a.media.push({ filename: 'private.png' }) },
  ]) {
    const fixture = setup()
    const changed = structuredClone(archive)
    mutate(changed)
    await assert.rejects(publishShizhang(fixture.cms, changed, { apply: true }))
    assert.equal(fixture.writes.length, 0)
  }
})
