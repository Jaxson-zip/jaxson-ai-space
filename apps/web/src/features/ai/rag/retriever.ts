import { generateLocalEmbedding, tokenize } from './embedder'
import type { KnowledgeChunk, RetrievalResult } from './types'

/**
 * Compute Cosine Similarity between two normalized vectors
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) return 0

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i]
    normA += vecA[i] * vecA[i]
    normB += vecB[i] * vecB[i]
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB)
  if (denominator === 0) return 0

  return Math.max(0, Math.min(1, dotProduct / denominator))
}

/**
 * Compute BM25 Score between query tokens and document tokens
 */
export function calculateBM25Score(
  queryTokens: string[],
  docTokens: string[],
  avgDocLength: number,
  totalDocs: number,
  docFrequencies: Map<string, number>,
  k1 = 1.5,
  b = 0.75
): number {
  if (queryTokens.length === 0 || docTokens.length === 0) return 0

  const docLength = docTokens.length
  const docTokenCounts = new Map<string, number>()
  for (const token of docTokens) {
    docTokenCounts.set(token, (docTokenCounts.get(token) || 0) + 1)
  }

  let score = 0
  for (const qToken of queryTokens) {
    const tf = docTokenCounts.get(qToken) || 0
    if (tf === 0) continue

    const df = docFrequencies.get(qToken) || 1
    // Standard IDF formula with smoothing
    const idf = Math.log((totalDocs - df + 0.5) / (df + 0.5) + 1)
    const numerator = tf * (k1 + 1)
    const denominator = tf + k1 * (1 - b + b * (docLength / Math.max(1, avgDocLength)))

    score += idf * (numerator / denominator)
  }

  return Math.max(0, score)
}

/**
 * Hybrid Retriever (Vector Cosine Similarity + BM25 Keyword Scoring)
 */
export function hybridRetrieve(
  query: string,
  chunks: KnowledgeChunk[],
  topK = 3,
  vectorWeight = 0.6
): RetrievalResult[] {
  if (chunks.length === 0 || !query.trim()) return []

  const queryTokens = tokenize(query)
  const queryEmbedding = generateLocalEmbedding(query)

  // Precompute document frequencies and tokenized chunks
  const totalDocs = chunks.length
  const tokenizedChunks: { chunk: KnowledgeChunk; tokens: string[]; embedding: number[] }[] = []
  const docFrequencies = new Map<string, number>()
  let totalLength = 0

  for (const chunk of chunks) {
    const chunkText = `${chunk.title} ${chunk.content} ${chunk.keywords.join(' ')}`
    const tokens = tokenize(chunkText)
    totalLength += tokens.length

    const uniqueTokens = new Set(tokens)
    for (const ut of uniqueTokens) {
      docFrequencies.set(ut, (docFrequencies.get(ut) || 0) + 1)
    }

    const embedding = chunk.embedding || generateLocalEmbedding(chunkText)
    tokenizedChunks.push({ chunk, tokens, embedding })
  }

  const avgDocLength = totalLength / totalDocs

  // Compute scores for each chunk
  const results: RetrievalResult[] = tokenizedChunks.map(({ chunk, tokens, embedding }) => {
    const vectorScore = cosineSimilarity(queryEmbedding, embedding)
    const rawBM25 = calculateBM25Score(queryTokens, tokens, avgDocLength, totalDocs, docFrequencies)
    // Normalize BM25 score to [0, 1] range approximately
    const bm25Score = Math.min(1, rawBM25 / 10)

    const finalScore = vectorWeight * vectorScore + (1 - vectorWeight) * bm25Score

    return {
      chunk,
      score: Number(finalScore.toFixed(4)),
      vectorScore: Number(vectorScore.toFixed(4)),
      bm25Score: Number(bm25Score.toFixed(4)),
    }
  })

  // Sort descending by score
  results.sort((a, b) => b.score - a.score)

  return results.slice(0, topK)
}
