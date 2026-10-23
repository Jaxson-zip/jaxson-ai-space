import { generateLocalEmbedding, tokenize } from './embedder'
import type { ChunkCategory, KnowledgeChunk, RetrievalResult } from './types'

// Short questions such as "你现在在哪里实习？" share only the topic word with the
// record. Experience and award records are not in the semantic index, so the
// topic itself must be enough to consider records of that category.
const TOPIC_CATEGORIES: [RegExp, ChunkCategory[]][] = [
  [/实习|工作经历|任职/, ['internship']],
  [/学校|学历|专业|毕业|gpa|绩点|成绩|读书|教育/i, ['education']],
  [/竞赛|获奖|奖项|荣誉|拿过.*奖|什么奖/, ['award']],
  [/技能|技术栈|擅长/, ['skill']],
  [/校园|社团|学生会|学信委/, ['campus']],
]

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
    const vectorScore = typeof chunk.vectorScore === 'number'
      ? Math.max(0, Math.min(1, chunk.vectorScore))
      : cosineSimilarity(queryEmbedding, embedding)
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

function inLoaderOrder(results: RetrievalResult[], chunks: KnowledgeChunk[]): RetrievalResult[] {
  const position = new Map(chunks.map((chunk, index) => [chunk.id, index]))
  return [...results].sort((a, b) => (position.get(a.chunk.id) ?? 0) - (position.get(b.chunk.id) ?? 0))
}

/** The local hash projection is not semantic evidence by itself. */
export function groundedRetrieve(query: string, chunks: KnowledgeChunk[], topK = 5): RetrievalResult[] {
  const projectChunks = chunks.filter((chunk) => chunk.category === 'project')
  // "Best work" questions get the projects the home page leads with.
  const wantsHighlights = /代表|最好|最满意|拿得出手|精选|主推|得意/.test(query) && /项目|作品/.test(query)
  const highlights = projectChunks.filter((chunk) => chunk.featured)
  if (wantsHighlights && highlights.length > 0) {
    return inLoaderOrder(hybridRetrieve(query, highlights, highlights.length), highlights)
  }
  const wantsProjectList = /项目|作品/.test(query) && /哪些|几个|所有|都|做过|上线|列出|介绍/.test(query)
  if (wantsProjectList) {
    // Every project, in the loader's (home page) order rather than by score.
    return inLoaderOrder(hybridRetrieve(query, projectChunks, Math.max(topK, projectChunks.length)), projectChunks)
  }

  const topics = new Set(TOPIC_CATEGORIES.flatMap(([pattern, categories]) => pattern.test(query) ? categories : []))
  const topicResults = topics.size > 0
    ? hybridRetrieve(query, chunks.filter((chunk) => topics.has(chunk.category)), topK)
    : []

  const queryTokens = new Set(tokenize(query))
  const minimumMatches = queryTokens.size >= 3 ? 2 : 1
  const evidenceResults = hybridRetrieve(query, chunks, topK).filter((result) => {
    if (result.chunk.vectorSource === 'semantic' && result.vectorScore >= 0.8) return true
    if (result.bm25Score <= 0) return false
    const evidenceTokens = new Set(tokenize(
      `${result.chunk.title} ${result.chunk.content} ${result.chunk.keywords.join(' ')}`,
    ))
    let matches = 0
    for (const token of queryTokens) {
      if (evidenceTokens.has(token)) matches += 1
      if (matches >= minimumMatches) return true
    }
    return false
  })

  const topicIds = new Set(topicResults.map((result) => result.chunk.id))
  return [...topicResults, ...evidenceResults.filter((result) => !topicIds.has(result.chunk.id))].slice(0, topK)
}
