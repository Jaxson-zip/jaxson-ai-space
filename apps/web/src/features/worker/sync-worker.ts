import { fetchSemanticEmbedding, type SemanticEmbeddingConfig } from '../ai/rag/embedder'

export interface OutboxTask {
  id: string
  eventType: 'PROJECT_PUBLISHED' | 'MEMORY_APPROVED' | 'EXPERIENCE_UPDATED' | 'KNOWLEDGE_ADDED'
  entityId: string
  title: string
  category: string
  content: string
  evidenceTag: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  createdAt: string
}

export interface KnowledgeEmbeddingRow {
  chunk_id: string
  category: string
  title: string
  content: string
  evidence_tag: string
  embedding: number[] // 1536-dimensional vector
  metadata: Record<string, unknown>
  generation_id?: string
  is_active?: boolean
}

/**
 * High-performance 1536-dimensional deterministic vector generator.
 * Produces normalized unit vectors for Cosine Similarity.
 * Pluggable with OpenAI / DeepSeek / DashScope text-embedding models when API key is present.
 */
export function generate1536Vector(text: string, _apiKey?: string): number[] {
  const DIMENSIONS = 1536
  const vector = new Array(DIMENSIONS).fill(0)
  const normalized = text.toLowerCase().trim()

  if (!normalized) {
    vector[0] = 1
    return vector
  }

  // Multi-hash n-gram projection into 1536-d space
  for (let i = 0; i < normalized.length; i++) {
    const charCode = normalized.charCodeAt(i)
    const pos1 = (charCode * 31 + i * 17) % DIMENSIONS
    const pos2 = (charCode * 59 + i * 37 + (normalized.charCodeAt(i + 1) || 0) * 13) % DIMENSIONS
    const pos3 = (charCode * 97 + i * 79 + (normalized.charCodeAt(i - 1) || 0) * 23) % DIMENSIONS

    vector[pos1] += 1.0
    vector[pos2] += 0.75
    vector[pos3] += 0.5
  }

  // Normalize to unit vector for cosine distance computation
  let normSquared = 0
  for (let i = 0; i < DIMENSIONS; i++) {
    normSquared += vector[i] * vector[i]
  }

  const norm = Math.sqrt(normSquared) || 1
  for (let i = 0; i < DIMENSIONS; i++) {
    vector[i] = Number((vector[i] / norm).toFixed(6))
  }

  return vector
}

/**
 * Chunks long text into cohesive RAG knowledge chunks.
 */
export function chunkText(content: string, maxChunkLength: number = 300): string[] {
  if (content.length <= maxChunkLength) {
    return [content.trim()]
  }

  const paragraphs = content.split(/\n+/).filter((p) => p.trim().length > 0)
  const chunks: string[] = []
  let current = ''

  for (const para of paragraphs) {
    if ((current + '\n' + para).length > maxChunkLength && current.length > 0) {
      chunks.push(current.trim())
      current = para
    } else {
      current = current ? `${current}\n${para}` : para
    }
  }

  if (current.trim().length > 0) {
    chunks.push(current.trim())
  }

  return chunks
}

/**
 * Worker execution unit: Processes outbox task and generates indexed embedding rows.
 */
export function processOutboxTask(task: OutboxTask): KnowledgeEmbeddingRow[] {
  const chunks = chunkText(task.content)
  const rows: KnowledgeEmbeddingRow[] = []

  chunks.forEach((chunk, index) => {
    const chunkId = `${task.entityId}_chunk_${index}`
    const embedding = generate1536Vector(`${task.title} ${chunk}`)

    rows.push({
      chunk_id: chunkId,
      category: task.category,
      title: `${task.title} (段落 ${index + 1})`,
      content: chunk,
      evidence_tag: task.evidenceTag,
      embedding,
      generation_id: task.id,
      is_active: true,
      metadata: {
        eventType: task.eventType,
        entityId: task.entityId,
        chunkIndex: index,
        totalChunks: chunks.length,
        processedAt: new Date().toISOString(),
      },
    })
  })

  return rows
}

/**
 * Generates semantic 1536-dimensional embedding using real API if configured,
 * or gracefully falls back to deterministic local projection.
 */
export async function generateSemanticOrLocal1536Vector(
  text: string,
  config?: SemanticEmbeddingConfig
): Promise<number[]> {
  const semantic = await fetchSemanticEmbedding(text, config)
  if (semantic && semantic.length === 1536) {
    return semantic
  }
  return generate1536Vector(text)
}

/**
 * Asynchronous worker execution unit: Processes outbox task using real semantic embeddings when available.
 */
export async function processOutboxTaskAsync(
  task: OutboxTask,
  config?: SemanticEmbeddingConfig
): Promise<KnowledgeEmbeddingRow[]> {
  const chunks = chunkText(task.content)
  const rows: KnowledgeEmbeddingRow[] = []

  for (let index = 0; index < chunks.length; index++) {
    const chunk = chunks[index]
    const chunkId = `${task.entityId}_chunk_${index}`
    const embedding = await generateSemanticOrLocal1536Vector(`${task.title} ${chunk}`, config)

    rows.push({
      chunk_id: chunkId,
      category: task.category,
      title: `${task.title} (段落 ${index + 1})`,
      content: chunk,
      evidence_tag: task.evidenceTag,
      embedding,
      generation_id: task.id,
      is_active: true,
      metadata: {
        eventType: task.eventType,
        entityId: task.entityId,
        chunkIndex: index,
        totalChunks: chunks.length,
        processedAt: new Date().toISOString(),
      },
    })
  }

  return rows
}

