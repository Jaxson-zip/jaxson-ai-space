export const CHAT_LIMITS = { messages: 10, messageChars: 2500, totalChars: 8000 } as const

export interface ConversationMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  replyTo?: string
  status?: 'streaming' | 'completed' | 'interrupted' | 'error' | 'stopped'
  isJdMatch?: boolean
  evidence?: readonly string[]
  generator?: 'external' | 'local'
}

/** Keep complete recent rounds, with the current question reserved in every budget. */
export function buildChatHistory(history: ConversationMessage[], question: ConversationMessage) {
  if (!question.content.trim() || question.content.length > CHAT_LIMITS.messageChars) {
    throw new Error('Question exceeds the message budget')
  }
  const result: { role: 'user' | 'assistant'; content: string }[] = [
    { role: 'user', content: question.content },
  ]
  let characters = question.content.length
  for (let index = history.length - 1; index > 0; index--) {
    const answer = history[index]
    const user = history[index - 1]
    if (answer.role !== 'assistant' || answer.status !== 'completed' || user.role !== 'user' || answer.replyTo !== user.id) continue
    // Keep whole facts: do not turn a cut-off old answer into completed context.
    if (!answer.content.trim() || answer.content.length > CHAT_LIMITS.messageChars || user.content.length > CHAT_LIMITS.messageChars) continue
    const roundChars = user.content.length + answer.content.length
    if (result.length + 2 > CHAT_LIMITS.messages || characters + roundChars > CHAT_LIMITS.totalChars) break
    result.unshift({ role: 'user', content: user.content }, { role: 'assistant', content: answer.content })
    characters += roundChars
    index--
  }
  return result
}
