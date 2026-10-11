export type ChunkCategory = 'internship' | 'project' | 'education' | 'campus' | 'award' | 'skill' | 'intent' | 'jd_match' | 'general'

export interface KnowledgeChunk {
  id: string
  title: string
  category: ChunkCategory
  content: string
  evidenceTag: string
  keywords: string[]
  embedding?: number[]
  /** Similarity calculated by the pgvector query, when loaded from PostgreSQL. */
  vectorScore?: number
  vectorSource?: 'local' | 'semantic'
}

export interface RetrievalResult {
  chunk: KnowledgeChunk
  score: number
  vectorScore: number
  bm25Score: number
}

export interface ChatMessage {
  id: string
  role: 'system' | 'user' | 'assistant'
  content: string
  evidence?: readonly string[]
  isJdMatch?: boolean
}

export interface RAGResponse {
  answer: string
  citations: readonly string[]
  relevantChunks: readonly KnowledgeChunk[]
  isJdMatch?: boolean
}
