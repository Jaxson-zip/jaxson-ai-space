import { createHash } from 'node:crypto'

export const CONTENT_FIELDS = {
  projects: ['title', 'shortTitle', 'projectDate', 'slug', 'role', 'category', 'visibility', 'status', 'summary', 'tags', 'problem', 'approach', 'outcome', 'editorialNote', 'highlights', 'demoUrl', 'repoUrl'],
  experiences: ['organization', 'role', 'period', 'type', 'description', 'bullets', 'tags'],
  credentials: ['name', 'category', 'year', 'level', 'items'],
  'ai-knowledge': ['title', 'category', 'content', 'isPublic', 'evidenceTag'],
}
const identityFields = {
  projects: ['slug'], experiences: ['organization', 'role', 'period', 'type'],
  credentials: ['name', 'category', 'year'], 'ai-knowledge': ['title', 'category'],
}
const requiredFields = {
  projects: ['slug', 'title', 'role', 'category', 'status', 'summary'],
  experiences: ['organization', 'role', 'period', 'type'],
  credentials: ['name', 'category'], 'ai-knowledge': ['title', 'category', 'content'],
}
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex')
const identity = (collection, doc) => JSON.stringify(identityFields[collection].map((field) => doc[field] ?? ''))

function clean(collection, doc) {
  const result = {}
  for (const key of CONTENT_FIELDS[collection]) {
    if (doc[key] === undefined) continue
    result[key] = Array.isArray(doc[key])
      ? doc[key].map((item) => Object.fromEntries(Object.entries(item).filter(([field]) => ['tag', 'item', 'bullet'].includes(field))))
      : doc[key]
  }
  return result
}

export async function createCmsClient(origin, email, password) {
  const base = new URL(origin)
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.pathname !== '/' || base.search || base.hash) {
    throw new Error('CMS URL must be an HTTP(S) origin')
  }
  if (!email || !password) throw new Error('Set CMS_EMAIL and CMS_PASSWORD (or OWNER_EMAIL and OWNER_INITIAL_PASSWORD)')
  const login = await fetch(new URL('/api/users/login', base), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }), signal: AbortSignal.timeout(15000),
  })
  if (!login.ok) throw new Error(`CMS login failed: HTTP ${login.status}`)
  const { token } = await login.json()
  if (!token) throw new Error('CMS login did not return a token')
  async function request(path, options = {}) {
    const response = await fetch(new URL(path, base), {
      ...options, headers: { Authorization: `JWT ${token}`, ...options.headers },
      signal: AbortSignal.timeout(30000),
    })
    if (!response.ok) throw new Error(`CMS request failed: ${new URL(path, base).pathname} HTTP ${response.status}`)
    return response
  }
  return {
    async list(collection) {
      if (!Object.hasOwn(CONTENT_FIELDS, collection)) throw new Error('Unsupported content collection')
      const docs = []
      for (let page = 1; page <= 10000; page += 1) {
        const result = await (await request(`/api/${collection}?limit=100&page=${page}&depth=1&sort=id`)).json()
        if (!Array.isArray(result.docs)) throw new Error('Invalid CMS collection response')
        docs.push(...result.docs)
        if (!result.hasNextPage) return docs
      }
      throw new Error('CMS pagination did not terminate')
    },
    async media(path) {
      const url = new URL(path, base)
      if (url.origin !== base.origin) throw new Error('Export only supports cover files served by the selected CMS origin')
      const response = await request(url.href)
      const bytes = new Uint8Array(await response.arrayBuffer())
      if (bytes.length > 25 * 1024 * 1024) throw new Error('Cover exceeds the 25 MB transfer limit')
      return bytes
    },
    async write(collection, doc, id) {
      return (await (await request(`/api/${collection}${id === undefined ? '' : `/${encodeURIComponent(id)}`}`, {
        method: id === undefined ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(doc),
      })).json()).doc
    },
    async upload(asset) {
      const form = new FormData()
      form.set('_payload', JSON.stringify({ alt: asset.alt || asset.filename }))
      form.set('file', new Blob([Buffer.from(asset.dataBase64, 'base64')], { type: asset.mimeType }), asset.filename)
      return (await (await request('/api/media', { method: 'POST', body: form })).json()).doc
    },
  }
}

export async function exportContent(client) {
  const archive = { format: 'jaxson-cms-content', version: 1, exportedAt: new Date().toISOString(), records: {}, media: [] }
  const exportedMedia = new Set()
  for (const collection of Object.keys(CONTENT_FIELDS)) {
    archive.records[collection] = []
    for (const doc of await client.list(collection)) {
      const record = clean(collection, doc)
      const cover = collection === 'projects' && doc.coverImage
      if (cover) {
        if (typeof cover !== 'object' || !cover.url || !client.media) throw new Error('Project cover is not populated or cannot be exported')
        const key = String(cover.id)
        record.sourceMediaKey = key
        if (!exportedMedia.has(key)) {
          const bytes = await client.media(cover.url)
          archive.media.push({ key, alt: cover.alt, filename: String(cover.filename).replace(/[\\/]/g, '_'), mimeType: cover.mimeType, dataBase64: Buffer.from(bytes).toString('base64'), sha256: digest(bytes) })
          exportedMedia.add(key)
        }
      }
      archive.records[collection].push(record)
    }
  }
  return archive
}

export async function importContent(client, archive, { apply = false, updateExisting = false } = {}) {
  if (archive.format !== 'jaxson-cms-content' || archive.version !== 1 || !archive.records || !Array.isArray(archive.media)) throw new Error('Unsupported content archive')
  if (Object.keys(archive.records).some((key) => !Object.hasOwn(CONTENT_FIELDS, key))) throw new Error('Archive contains unsupported collections')
  const assets = new Map()
  for (const asset of archive.media) {
    if (!asset.key || assets.has(asset.key) || !asset.filename || /[\\/]/.test(asset.filename)) throw new Error('Invalid cover asset')
    const bytes = Buffer.from(asset.dataBase64 || '', 'base64')
    if (bytes.length > 25 * 1024 * 1024 || digest(bytes) !== asset.sha256) throw new Error('Cover checksum or size validation failed')
    assets.set(asset.key, asset)
  }
  // Validate the complete plan before any upload or record write.
  const plan = []
  for (const collection of Object.keys(CONTENT_FIELDS)) {
    const records = archive.records[collection] || []
    if (!Array.isArray(records)) throw new Error('Invalid content records')
    const existing = await client.list(collection)
    const seen = new Set()
    for (const record of records) {
      if (!record || typeof record !== 'object' || requiredFields[collection].some((field) => typeof record[field] !== 'string' || !record[field].trim())) {
        throw new Error(`Missing required content fields in ${collection}`)
      }
      if (collection === 'projects' && !['public', 'private'].includes(record.visibility)) throw new Error('Invalid project visibility')
      if (collection === 'ai-knowledge' && typeof record.isPublic !== 'boolean') throw new Error('Knowledge visibility must be explicit')
      clean(collection, record)
      const key = identity(collection, record)
      if (seen.has(key)) throw new Error(`Duplicate archive identity in ${collection}`)
      seen.add(key)
      const matches = existing.filter((doc) => identity(collection, doc) === key)
      if (matches.length > 1) throw new Error(`Ambiguous target identity in ${collection}`)
      if (record.sourceMediaKey && !assets.has(record.sourceMediaKey)) throw new Error('Missing referenced cover asset')
      plan.push({ collection, record, existing: matches[0] })
    }
  }
  const result = { dryRun: !apply, created: 0, updated: 0, skipped: 0 }
  const uploaded = new Map()
  for (const entry of plan) {
    if (entry.existing && !updateExisting) { result.skipped += 1; continue }
    if (entry.existing) result.updated += 1
    else result.created += 1
    if (!apply) continue
    const doc = clean(entry.collection, entry.record)
    if (entry.record.sourceMediaKey) {
      const key = entry.record.sourceMediaKey
      if (!uploaded.has(key)) {
        const media = await client.upload(assets.get(key))
        if (!media?.id) throw new Error('Cover upload returned no ID')
        uploaded.set(key, media.id)
      }
      doc.coverImage = uploaded.get(key)
    }
    await client.write(entry.collection, doc, entry.existing?.id)
  }
  return result
}
