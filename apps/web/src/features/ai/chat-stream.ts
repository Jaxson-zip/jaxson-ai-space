import { SSEParser } from './sse'
import type { ConversationSource } from './chat-history'

type ChatStreamEvent =
  | { type: 'text'; text: string }
  | { type: 'meta'; evidence: string[]; sources: ConversationSource[]; generator?: 'external' | 'local' }

function isSource(source: unknown): source is ConversationSource {
  return typeof source === 'object' && source !== null && 'tag' in source && typeof source.tag === 'string' &&
    (!('project' in source) || source.project === undefined || typeof source.project === 'string')
}

export async function consumeChatStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: ChatStreamEvent) => void,
  signal: AbortSignal,
) {
  const reader = body.getReader()
  const parser = new SSEParser()
  let hasText = false
  const cancel = () => { void reader.cancel().catch(() => {}) }
  signal.addEventListener('abort', cancel, { once: true })
  try {
    signal.throwIfAborted()
    while (true) {
      const { value, done } = await reader.read()
      signal.throwIfAborted()
      if (done) throw new Error('Chat stream ended without completion')
      for (const event of parser.push(value)) {
        if (!['meta', 'text', 'done', 'error'].includes(event.event)) continue
        const data = JSON.parse(event.data)
        if (!data || typeof data !== 'object') throw new Error('Invalid chat stream event')
        if (event.event === 'error') throw new Error('Chat stream interrupted')
        if (event.event === 'done') {
          if (!hasText) throw new Error('Chat stream completed without an answer')
          return
        }
        if (event.event === 'meta') {
          const evidence = Array.isArray(data.evidence) ? data.evidence.filter((tag: unknown) => typeof tag === 'string') : []
          const rawSources: unknown = data.sources
          const sources: ConversationSource[] = Array.isArray(rawSources) && rawSources.every(isSource)
            ? rawSources.map((source) => ({ tag: source.tag, ...(source.project ? { project: source.project } : {}) }))
            : evidence.map((tag: string) => ({ tag }))
          onEvent({
            type: 'meta',
            evidence,
            sources,
            generator: data.generator === 'local' || data.generator === 'external' ? data.generator : undefined,
          })
        } else if (event.event === 'text') {
          if (typeof data.text !== 'string') throw new Error('Invalid chat text event')
          if (data.text) {
            hasText = true
            onEvent({ type: 'text', text: data.text })
          }
        }
      }
    }
  } finally {
    signal.removeEventListener('abort', cancel)
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}
