import assert from 'node:assert/strict'

function sameFields(actual, expected) {
  if (Array.isArray(expected)) {
    return Array.isArray(actual) && actual.length === expected.length
      && expected.every((value, index) => sameFields(actual[index], value))
  }
  if (expected && typeof expected === 'object') {
    return actual && typeof actual === 'object'
      && Object.entries(expected).every(([key, value]) => sameFields(actual[key], value))
  }
  return actual === expected
}

/** Only create the two owner-approved public Shizhang records; never update or delete. */
export async function publishShizhang(cms, archive, { apply = false } = {}) {
  assert.equal(archive.format, 'jaxson-cms-content')
  assert.equal(archive.version, 1)
  assert.deepEqual(Object.keys(archive.records).sort(), ['ai-knowledge', 'projects'])
  assert.deepEqual(archive.media, [])
  const projects = archive.records.projects
  const knowledge = archive.records['ai-knowledge']
  assert.equal(projects.length, 1)
  assert.equal(knowledge.length, 1)
  assert.equal(projects[0].slug, 'shizhang')
  assert.equal(projects[0].visibility, 'public')
  assert.equal(projects[0].featured, false)
  assert.equal(projects[0].repoUrl, 'https://github.com/Jaxson-zip/shizhang')
  assert.equal(projects[0].demoUrl, undefined)
  assert.equal(projects[0].coverImage, undefined)
  assert.equal(projects[0].demoVideo, undefined)
  assert.equal(knowledge[0].title, '拾账 Shizhang：记账采集、识别核对与开源改造')
  assert.equal(knowledge[0].category, 'project')
  assert.equal(knowledge[0].isPublic, true)
  const plan = []
  const before = {}
  for (const [collection, records] of Object.entries(archive.records)) {
    const docs = await cms.list(collection)
    before[collection] = docs.filter(doc => collection === 'projects'
      ? doc.visibility === 'public' : doc.isPublic === true).length
    const record = records[0]
    const matches = docs.filter(doc => collection === 'projects'
      ? doc.slug === record.slug : doc.title === record.title && doc.category === record.category)
    assert.ok(matches.length <= 1, 'AMBIGUOUS_EXISTING_RECORD')
    if (matches.length) assert.ok(sameFields(matches[0], record), 'EXISTING_CONTENT_DIFFERS')
    plan.push({ collection, record, existing: matches[0] })
  }
  // The whole create-only plan is checked before the first write. A partial run can be resumed.
  const result = { apply, publicBefore: before, created: [], existing: [], plannedCreates: 0 }
  for (const item of plan) {
    if (item.existing) {
      result.existing.push({ collection: item.collection, id: item.existing.id })
    } else {
      result.plannedCreates += 1
      if (apply) {
        const created = await cms.write(item.collection, item.record)
        assert.ok(created?.id, 'CREATE_RESPONSE_MISSING_ID')
        // Re-read after all operations rather than interpreting a successful HTTP status as success.
        result.created.push({ collection: item.collection, id: created.id })
      }
    }
  }
  if (apply) {
    result.verified = []
    for (const item of plan) {
      const docs = await cms.list(item.collection)
      const matches = docs.filter(doc => item.collection === 'projects'
        ? doc.slug === item.record.slug : doc.title === item.record.title && doc.category === item.record.category)
      assert.equal(matches.length, 1, 'POST_WRITE_IDENTITY_MISMATCH')
      assert.ok(sameFields(matches[0], item.record), 'POST_WRITE_CONTENT_MISMATCH')
      result.verified.push({ collection: item.collection, id: matches[0].id, public: true })
    }
  }
  return result
}
