import pg from 'pg'

const { Pool } = pg
const pool = new Pool({
  connectionString: process.env.DATABASE_URI,
  max: 2,
  idleTimeoutMillis: 5000,
})

function generate1536Vector(text) {
  const dimensions = 1536
  const vector = new Array(dimensions).fill(0)
  const normalized = String(text).toLowerCase().trim()
  if (!normalized) {
    vector[0] = 1
    return vector
  }
  for (let i = 0; i < normalized.length; i += 1) {
    const code = normalized.charCodeAt(i)
    vector[(code * 31 + i * 17) % dimensions] += 1
    vector[(code * 59 + i * 37 + (normalized.charCodeAt(i + 1) || 0) * 13) % dimensions] += 0.75
    vector[(code * 97 + i * 79 + (normalized.charCodeAt(i - 1) || 0) * 23) % dimensions] += 0.5
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1
  return vector.map((value) => Number((value / norm).toFixed(6)))
}

function chunkText(content, maxLength = 300) {
  if (content.length <= maxLength) return [content.trim()]
  const paragraphs = content.split(/\n+/).filter((paragraph) => paragraph.trim())
  const chunks = []
  let current = ''
  for (const paragraph of paragraphs) {
    if ((current + '\n' + paragraph).length > maxLength && current) {
      chunks.push(current.trim())
      current = paragraph
    } else {
      current = current ? `${current}\n${paragraph}` : paragraph
    }
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks
}

async function claimTask() {
  const result = await pool.query(`
    WITH next_task AS (
      SELECT id FROM owner.outbox_events
      WHERE available_at <= NOW()
        AND (
          status = 'pending'
          OR (
            status = 'processing'
            AND (locked_at IS NULL OR locked_at < NOW() - INTERVAL '5 minutes')
          )
        )
      ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1
    )
    UPDATE owner.outbox_events AS task
    SET status = 'processing', locked_at = NOW(), attempts = attempts + 1
    FROM next_task WHERE task.id = next_task.id RETURNING task.*
  `)
  return result.rows[0]
}

async function processTask(task) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      `UPDATE public_read.knowledge_embeddings
       SET is_active = FALSE, updated_at = NOW()
       WHERE chunk_id LIKE $1 OR metadata->>'entityId' = $2`,
      [`${task.entity_id}_chunk_%`, task.entity_id],
    )
    if (task.content) {
      const chunks = chunkText(task.content)
      for (let index = 0; index < chunks.length; index += 1) {
        const content = chunks[index]
        const vector = `[${generate1536Vector(`${task.title} ${content}`).join(',')}]`
        await client.query(
          `INSERT INTO public_read.knowledge_embeddings
             (chunk_id, category, title, content, evidence_tag, embedding, metadata, generation_id, is_active)
           VALUES ($1, $2, $3, $4, $5, $6::vector, $7::jsonb, $8, TRUE)
           ON CONFLICT (chunk_id) DO UPDATE SET category = EXCLUDED.category,
             title = EXCLUDED.title, content = EXCLUDED.content, evidence_tag = EXCLUDED.evidence_tag,
             embedding = EXCLUDED.embedding, metadata = EXCLUDED.metadata,
             generation_id = EXCLUDED.generation_id, is_active = TRUE, updated_at = NOW()`,
          [
            `${task.entity_id}_chunk_${index}`, task.category,
            `${task.title} (段落 ${index + 1})`, content, task.evidence_tag, vector,
            JSON.stringify({ entityId: task.entity_id, eventType: task.event_type, chunkIndex: index, totalChunks: chunks.length }),
            String(task.id),
          ],
        )
      }
    }
    await client.query(
      `UPDATE owner.outbox_events SET status = 'completed', completed_at = NOW(), last_error = NULL WHERE id = $1`,
      [task.id],
    )
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    await pool.query(
      `UPDATE owner.outbox_events SET status = CASE WHEN attempts >= 5 THEN 'failed' ELSE 'pending' END,
       available_at = NOW() + INTERVAL '30 seconds', last_error = $2 WHERE id = $1`,
      [task.id, String(error instanceof Error ? error.message : error)],
    )
  } finally {
    client.release()
  }
}

async function run() {
  try {
    do {
      const task = await claimTask()
      if (task) await processTask(task)
      if (process.env.WORKER_ONCE === 'true') break
      if (!task) await new Promise((resolve) => setTimeout(resolve, 1000))
    } while (true)
  } finally {
    await pool.end()
  }
}

run().catch((error) => {
  console.error('[index-worker] fatal error:', error)
  process.exitCode = 1
})
