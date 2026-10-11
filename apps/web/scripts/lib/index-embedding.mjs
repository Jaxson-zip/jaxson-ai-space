export const LOCAL_MODEL_KEY = 'local-hash-v1:1536'
const DIMENSIONS = 1536

export function getIndexEmbeddingConfig(env = process.env) {
  const mode = env.EMBEDDING_MODE || 'local'
  if (!['local', 'semantic'].includes(mode)) throw new Error('EMBEDDING_MODE must be local or semantic')
  if (mode === 'local') return { mode, modelKey: LOCAL_MODEL_KEY }
  const apiKey = env.EMBEDDING_API_KEY?.trim()
  if (!apiKey) throw new Error('Semantic embeddings require EMBEDDING_API_KEY')
  const base = new URL(env.EMBEDDING_BASE_URL || 'https://api.openai.com/v1')
  if (!['https:', 'http:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
    throw new Error('Invalid EMBEDDING_BASE_URL')
  }
  const baseUrl = base.href.replace(/\/+$/, '')
  const model = env.EMBEDDING_MODEL?.trim() || 'text-embedding-3-small'
  const timeoutMs = Number(env.EMBEDDING_TIMEOUT_MS || 5000)
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30000) {
    throw new Error('EMBEDDING_TIMEOUT_MS must be between 100 and 30000')
  }
  return { mode, apiKey, baseUrl, model, timeoutMs, modelKey: `semantic:${baseUrl}:${model}:${DIMENSIONS}` }
}

export function generateLocalIndexVector(text) {
  const vector = Array(DIMENSIONS).fill(0)
  const normalized = String(text).toLowerCase().trim()
  if (!normalized) { vector[0] = 1; return vector }
  for (let i = 0; i < normalized.length; i += 1) {
    const code = normalized.charCodeAt(i)
    vector[(code * 31 + i * 17) % DIMENSIONS] += 1
    vector[(code * 59 + i * 37 + (normalized.charCodeAt(i + 1) || 0) * 13) % DIMENSIONS] += 0.75
    vector[(code * 97 + i * 79 + (normalized.charCodeAt(i - 1) || 0) * 23) % DIMENSIONS] += 0.5
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0))
  return vector.map((value) => Number((value / norm).toFixed(6)))
}

export async function embedIndexText(text, config = getIndexEmbeddingConfig()) {
  if (config.mode === 'local') return { vector: generateLocalIndexVector(text), modelKey: config.modelKey }
  const response = await fetch(`${config.baseUrl}/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({ model: config.model, input: text, dimensions: DIMENSIONS }),
    signal: AbortSignal.timeout(config.timeoutMs),
  })
  if (!response.ok) throw new Error(`Semantic embedding request failed: HTTP ${response.status}`)
  const data = await response.json()
  const vector = data.data?.[0]?.embedding
  if (!Array.isArray(vector) || vector.length !== DIMENSIONS || vector.some((value) => typeof value !== 'number' || !Number.isFinite(value))) {
    throw new Error('Invalid semantic embedding: expected 1536 finite numbers')
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0))
  if (!Number.isFinite(norm) || norm === 0) throw new Error('Invalid semantic embedding: zero or nonfinite norm')
  return { vector: vector.map((value) => Number((value / norm).toFixed(6))), modelKey: config.modelKey }
}
