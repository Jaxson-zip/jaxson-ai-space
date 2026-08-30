export type ChunkCategory = 'internship' | 'project' | 'education' | 'campus' | 'award' | 'skill' | 'intent' | 'general'

export interface KnowledgeChunk {
  id: string
  title: string
  category: ChunkCategory
  content: string
  evidenceTag: string
  keywords: string[]
  embedding?: number[]
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
