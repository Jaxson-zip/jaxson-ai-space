export const LOCAL_MODEL_KEY: string
export interface IndexEmbeddingConfig {
  mode: 'local' | 'semantic'
  modelKey: string
  apiKey?: string
  baseUrl?: string
  model?: string
  timeoutMs?: number
}
export function getIndexEmbeddingConfig(env?: Record<string, string | undefined>): IndexEmbeddingConfig
export function generateLocalIndexVector(text: string): number[]
export function embedIndexText(text: string, config?: IndexEmbeddingConfig): Promise<{ vector: number[]; modelKey: string }>
