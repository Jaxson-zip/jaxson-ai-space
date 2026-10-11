import pg from 'pg'
import { createCmsClient } from './lib/cms-transfer.mjs'
import { getIndexEmbeddingConfig } from './lib/index-embedding.mjs'

getIndexEmbeddingConfig()
if (!process.env.DATABASE_URI) throw new Error('Reindex requires DATABASE_URI')
const cms = await createCmsClient(process.env.API_ORIGIN || 'http://web:3000', process.env.OWNER_EMAIL, process.env.OWNER_INITIAL_PASSWORD)
const projects = (await cms.list('projects')).filter((doc) => doc.visibility === 'public')
const knowledge = (await cms.list('ai-knowledge')).filter((doc) => doc.isPublic === true)
const events = [
  ...projects.map((doc) => [
    'PROJECT_PUBLISHED', `proj-${doc.slug}`, doc.title, doc.category,
    `【项目背景】${doc.problem || ''}\n【技术方案】${doc.approach || ''}\n【交付结果】${doc.outcome || ''}\n【技术栈】${(doc.tags || []).map((tag) => tag.tag || '').filter(Boolean).join('、')}`,
    `project:${doc.title}`,
  ]),
  ...knowledge.map((doc) => ['KNOWLEDGE_ADDED', `knowledge-${doc.id}`, doc.title, doc.category, doc.content, doc.evidenceTag || `knowledge:${doc.title}`]),
]
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URI, max: 1 })
const client = await pool.connect()
try {
  await client.query('BEGIN')
  await client.query("UPDATE public_read.knowledge_embeddings SET is_active=FALSE WHERE metadata->>'entityId' LIKE 'proj-%' OR metadata->>'entityId' LIKE 'knowledge-%'")
  for (const event of events) {
    await client.query('INSERT INTO owner.outbox_events (event_type, entity_id, title, category, content, evidence_tag) VALUES ($1,$2,$3,$4,$5,$6)', event)
  }
  await client.query('COMMIT')
  console.log(JSON.stringify({ enqueuedProjects: projects.length, enqueuedKnowledge: knowledge.length }))
} catch (error) {
  await client.query('ROLLBACK')
  throw error
} finally {
  client.release()
  await pool.end()
}
