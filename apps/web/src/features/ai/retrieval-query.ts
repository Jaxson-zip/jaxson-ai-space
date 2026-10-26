import { CHAT_LIMITS } from './chat-history'

type Message = { role: 'user' | 'assistant'; content: string }

export function isContextDependentQuestion(question: string): boolean {
  const text = question.trim().replace(/[？?。.!！]+$/, '').trim()
  if (/^(?:能不能|能|可以|请)?(?:再|更)?(?:展开|详细|具体)(?:讲讲|说说|介绍|一点|一些|些|讲|说)?(?:吗|么)?$/.test(text)) return true
  if (/^(?:请)?(?:继续(?:讲讲|说说|介绍|讲|说)?|还有呢|然后呢|为什么)$/.test(text)) return true
  if (/^(?:(?:can|could) you )?(?:please )?(?:elaborate|continue|tell me more)(?: please)?$/i.test(text)) return true
  if (/^how does (?:it|this) work$/i.test(text)) return true
  // Require the entire remaining question to be generic too: "这个项目和新项目…"
  // or "那你的实习经历呢" must keep their independently stated subject.
  const tail = text.replace(/^(?:那|那么)?(?:它|这(?:个|项)(?:项目|作品|工作|方案)|那(?:个|项)(?:项目|作品|工作|方案)|该项目|这方面)(?:的)?/, '')
  return tail !== text && /^(?:有什么(?:功能|特点|难点|优势|不足)|(?:技术栈|功能|特点|难点|实现方式|实现方案|架构|效果|结果)(?:是什么|有哪些|怎么样|呢)?|(?:是)?(?:怎么|如何)(?:实现|做|设计|开发)(?:的)?|用(?:了)?(?:什么|哪些)(?:技术|框架|方案))(?:吗|呢)?$/.test(tail)
}

/** Undefined means independent; an empty string means the followup has no recoverable user topic. */
export function retrievalSubjectQuery(messages: readonly Message[]): string | undefined {
  const question = messages.at(-1)?.content.trim() ?? ''
  if (!isContextDependentQuestion(question)) return undefined
  const previous = messages.slice(-CHAT_LIMITS.messages, -1).reverse()
    .find((message) => message.role === 'user' && message.content.trim() && !isContextDependentQuestion(message.content))
  return previous?.content.trim() ?? ''
}

/** Recover a topic for retrieval only. Previous answers are never a source of facts. */
export function buildRetrievalQuery(messages: readonly Message[]): string {
  const question = messages.at(-1)?.content.trim() ?? ''
  const topic = retrievalSubjectQuery(messages)
  if (!topic) return question
  const available = CHAT_LIMITS.messageChars - question.length - 1
  return available > 0 && topic ? `${topic.slice(0, available)}\n${question}` : question
}
