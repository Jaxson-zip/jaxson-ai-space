import { CHAT_LIMITS, type ConversationMessage, type ConversationSource } from './chat-history'

export interface ConversationSnapshot { messages: ConversationMessage[]; draft: string }
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

/** Treat cross-window data as untrusted, even after checking its source and origin. */
export function readConversationSnapshot(value: unknown): ConversationSnapshot | null {
  if (!record(value) || typeof value.draft !== 'string' || value.draft.length > CHAT_LIMITS.messageChars ||
    !Array.isArray(value.messages) || value.messages.length > 100 || value.messages.length % 2 !== 0) return null
  const messages: ConversationMessage[] = []
  let total = value.draft.length
  for (const [index, raw] of value.messages.entries()) {
    if (!record(raw) || typeof raw.content !== 'string') return null
    const isUser = index % 2 === 0
    if (raw.role !== (isUser ? 'user' : 'assistant') || raw.content.length > (isUser ? CHAT_LIMITS.messageChars : 24000)) return null
    total += raw.content.length
    if (total > 200000 || (isUser && !raw.content.trim())) return null
    const id = `handoff-${index}`
    if (isUser) {
      messages.push({ id, role: 'user', content: raw.content,
        ...(typeof raw.createdAt === 'string' && Number.isFinite(Date.parse(raw.createdAt)) ? { createdAt: raw.createdAt } : {}) })
      continue
    }
    if (!['completed', 'interrupted', 'error', 'stopped'].includes(String(raw.status)) || (raw.status === 'completed' && !raw.content.trim())) return null
    const evidence = raw.evidence ?? []
    const sources = raw.sources ?? []
    if (!Array.isArray(evidence) || evidence.length > 20 || !evidence.every(tag => typeof tag === 'string' && tag.length <= 500) ||
      !Array.isArray(sources) || sources.length > 20 || !sources.every(source => record(source) && typeof source.tag === 'string' && source.tag.length <= 500 &&
        (source.project === undefined || (typeof source.project === 'string' && source.project.length <= 200)))) return null
    messages.push({ id, role: 'assistant', content: raw.content, replyTo: `handoff-${index - 1}`,
      status: raw.status as ConversationMessage['status'], isJdMatch: raw.isJdMatch === true,
      evidence: [...evidence], sources: sources.map((source: ConversationSource) => ({ tag: source.tag, ...(source.project ? { project: source.project } : {}) })),
      ...(typeof raw.errorMessage === 'string' ? { errorMessage: raw.errorMessage.slice(0, 500) } : {}),
      ...(raw.generator === 'local' || raw.generator === 'external' ? { generator: raw.generator } : {}),
    })
  }
  return { messages, draft: value.draft }
}
