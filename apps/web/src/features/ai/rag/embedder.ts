/**
 * Dual-Engine Vector Embedder Architecture:
 * 
 * 1. Lightweight 64-d Semantic Projection (Default Edge / In-Memory Engine):
 *    - Zero external dependency, sub-millisecond execution.
 *    - Tokenizes queries and computes L2-normalized dense representations with bi-gram capture.
 *    - Powers the zero-latency hybrid BM25 + Vector retriever on Vercel/Node edge runtimes.
 * 
 * 2. Enterprise 1536-d pgvector Pipeline (PostgreSQL HNSW Engine - sync-worker.ts):
 *    - Persisted in PostgreSQL `public_read.knowledge_embeddings` table.
 *    - Used by asynchronous ingestion workers for large-scale cosine nearest neighbor searches.
 */

export const VECTOR_DIM = 64

// Common Chinese & English stop words to filter out
const STOP_WORDS = new Set([
  '的', '了', '和', '是', '在', '我', '有', '于', '与', '这', '也', '但', '就', '你', '他', '她', '它',
  'a', 'an', 'the', 'in', 'on', 'at', 'for', 'to', 'of', 'and', 'or', 'is', 'are', 'was', 'were',
])

export function tokenize(text: string): string[] {
  const normalized = text.toLowerCase()
  // Extract Chinese characters, English words, and technical terms
  const rawTokens = normalized.match(/[\u4e00-\u9fa5]|[a-zA-Z0-9_#+.-]+/g) || []
  return rawTokens.filter((token) => !STOP_WORDS.has(token) && token.trim().length > 0)
}

function stringToHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

/**
 * Generate a normalized dense vector for any text
 */
export function generateLocalEmbedding(text: string): number[] {
  const tokens = tokenize(text)
  const vector = new Array<number>(VECTOR_DIM).fill(0)

  if (tokens.length === 0) {
    return vector
  }

  // Token frequency and bi-gram hashing
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    const idx = stringToHash(token) % VECTOR_DIM
    vector[idx] += 1

    // Include bi-grams for phrase semantic capture
    if (i < tokens.length - 1) {
      const bigram = `${token}_${tokens[i + 1]}`
      const bigramIdx = stringToHash(bigram) % VECTOR_DIM
      vector[bigramIdx] += 1.5
    }
  }

  // L2 Normalize
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0))
  if (magnitude === 0) return vector

  return vector.map((val) => val / magnitude)
}

export interface SemanticEmbeddingConfig {
  apiKey?: string
  baseUrl?: string
  model?: string
  dimensions?: number
  signal?: AbortSignal
}

/**
 * Fetch real high-dimensional semantic embedding via OpenAI-compatible Embedding API
 * (e.g. OpenAI text-embedding-3-small, DashScope text-embedding-v3, SiliconFlow bge-m3, etc.)
 */
export async function fetchSemanticEmbedding(
  text: string,
  config?: SemanticEmbeddingConfig
): Promise<number[] | null> {
  const apiKey =
    config?.apiKey ||
    process.env.EMBEDDING_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.DASHSCOPE_API_KEY

  if (!apiKey) {
    return null
  }

  const isDashScope = Boolean(
    process.env.DASHSCOPE_API_KEY && !process.env.OPENAI_API_KEY && !process.env.EMBEDDING_API_KEY
  )
  const baseUrl =
    config?.baseUrl ||
    process.env.EMBEDDING_BASE_URL ||
    (isDashScope ? 'https://dashscope.aliyuncs.com/compatible-mode/v1' : 'https://api.openai.com/v1')

  const model =
    config?.model ||
    process.env.EMBEDDING_MODEL ||
    (isDashScope ? 'text-embedding-v3' : 'text-embedding-3-small')

  const dimensions = config?.dimensions ?? 1536

  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: text,
        dimensions,
      }),
      signal: config?.signal,
    })

    if (!res.ok) {
      console.warn(
        `[embedder] Embedding API responded with status ${res.status}: ${await res.text().catch(() => '')}`
      )
      return null
    }

    const json = (await res.json()) as { data?: Array<{ embedding?: number[] }> }
    const rawVector = json.data?.[0]?.embedding
    if (!Array.isArray(rawVector) || rawVector.length === 0) {
      return null
    }

    // Ensure L2 normalization
    const norm = Math.sqrt(rawVector.reduce((sum, v) => sum + v * v, 0))
    if (norm === 0) return rawVector
    return rawVector.map((v) => Number((v / norm).toFixed(6)))
  } catch (err) {
    console.warn('[embedder] Failed to fetch semantic embedding, falling back to local:', err)
    return null
  }
}

