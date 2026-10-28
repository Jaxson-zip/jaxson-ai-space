import type { ChatMessage, RetrievalResult } from './types'
import { buildSystemPrompt } from './prompt-builder'
import { SSEParser } from '../sse'
import { isJobMatchRequest } from '../jd-intent'

interface StreamResponseConfig {
  messages: ChatMessage[]
  retrievalResults: RetrievalResult[]
  isJdMatch?: boolean
  signal?: AbortSignal
}

/**
 * Generate a streaming response using either a configured LLM provider or the built-in local RAG generator.
 */
export async function createRAGStream(config: StreamResponseConfig): Promise<ReadableStream<Uint8Array>> {
  const { messages, retrievalResults, signal } = config
  const isJdMatch = config.isJdMatch ?? isJobMatchRequest(messages.at(-1)?.content || '')
  signal?.throwIfAborted()
  const encoder = new TextEncoder()

  const systemPrompt = buildSystemPrompt(retrievalResults, isJdMatch)
  const userMessage = messages[messages.length - 1]?.content || ''

  // 1. Check for external LLM API configurations
  const deepseekKey = process.env.DEEPSEEK_API_KEY?.trim()
  const dashscopeKey = process.env.DASHSCOPE_API_KEY?.trim()
  const openaiKey = process.env.OPENAI_API_KEY?.trim()

  const apiKey = deepseekKey || dashscopeKey || openaiKey
  const baseUrl = deepseekKey
    ? (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1')
    : dashscopeKey
    ? (process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1')
    : (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1')
  const model = deepseekKey
    ? (process.env.DEEPSEEK_MODEL || 'deepseek-flash')
    : dashscopeKey
    ? 'qwen-plus'
    : (process.env.OPENAI_MODEL || 'gpt-4o-mini')
  const provider = deepseekKey ? 'deepseek' : dashscopeKey ? 'dashscope' : 'openai'

  const evidenceTags = retrievalResults.map((r) => r.chunk.evidenceTag)
  // Numbered like the prompt's 【事实证据 n】, so the page can match each [n] in the answer to its source.
  const sources = retrievalResults.map(({ chunk }) => chunk.project ? { tag: chunk.evidenceTag, project: chunk.project } : { tag: chunk.evidenceTag })

  // If a live LLM API key is present, stream and transform from the provider
  if (apiKey && retrievalResults.length > 0) {
    const upstreamAbort = new AbortController()
    const upstreamSignal = signal ? AbortSignal.any([signal, upstreamAbort.signal]) : upstreamAbort.signal
    // Budget the wait for the first answer separately from gaps during generation.
    // A progressing long answer must not hit an absolute 20-second body deadline.
    let timeoutCode = 'first_token_timeout'
    let timer: ReturnType<typeof setTimeout> | undefined
    const armTimeout = (code: string) => {
      clearTimeout(timer)
      timeoutCode = code
      timer = setTimeout(() => upstreamAbort.abort(), 20000)
    }
    armTimeout('first_token_timeout')
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages.map((m) => ({ role: m.role, content: m.content })),
          ],
          stream: true,
          temperature: 0.3,
          max_tokens: 1024,
          ...(deepseekKey ? { thinking: { type: 'disabled' } } : {}),
        }),
        signal: upstreamSignal,
      })
      signal?.throwIfAborted()

      if (response.ok && response.body) {
        const upstreamReader = response.body.getReader()
        const parser = new SSEParser()
        let ended = false
        let cancelled = false
        let hasText = false
        let controller: ReadableStreamDefaultController<Uint8Array>
        const emit = (event: string, data: object) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        const finish = (code?: string) => {
          if (ended) return
          ended = true
          clearTimeout(timer)
          upstreamSignal.removeEventListener('abort', onAbort)
          if (!cancelled) {
            if (signal?.aborted) {
              // The visitor left; nothing more to send.
            } else if (code && !hasText) {
              // The model failed before its first word (cold start, dropped connection, empty reply):
              // answer from the retrieved facts instead of showing an error.
              console.warn('[RAG] External LLM failed before answering; using local generator:', code)
              emit('meta', { evidence: evidenceTags, sources, isJdMatch, generator: 'local' })
              emit('text', { text: buildLocalRAGAnswer(userMessage, retrievalResults, isJdMatch) })
              emit('done', {})
            } else {
              emit(code ? 'error' : 'done', code ? { code } : {})
            }
            controller.close()
          }
          void upstreamReader.cancel().catch(() => {})
          upstreamAbort.abort()
        }
        const onAbort = () => finish(signal?.aborted ? 'cancelled' : timeoutCode)
        const pump = async () => {
          try {
            while (!ended) {
              const { done, value } = await upstreamReader.read()
              if (ended) return
              if (done) { finish('upstream_incomplete'); return }
              for (const event of parser.push(value)) {
                if (event.data === '[DONE]') { finish(hasText ? undefined : 'upstream_empty'); return }
                const json = JSON.parse(event.data)
                if (!json || typeof json !== 'object' || json.error) { finish('upstream_invalid'); return }
                const choice = json.choices?.[0]
                const delta = choice?.delta?.content
                if (typeof delta === 'string' && delta) {
                  hasText = true
                  armTimeout('stream_idle_timeout')
                  emit('text', { text: delta })
                }
                if (choice?.finish_reason && choice.finish_reason !== 'stop') { finish('upstream_truncated'); return }
              }
            }
          } catch {
            finish('upstream_interrupted')
          }
        }
        return new ReadableStream<Uint8Array>({
          start(value) {
            controller = value
            upstreamSignal.addEventListener('abort', onAbort, { once: true })
            if (upstreamSignal.aborted) { onAbort(); return }
            emit('meta', { evidence: evidenceTags, sources, isJdMatch, generator: 'external', provider, model })
            void pump()
          },
          cancel() {
            cancelled = true
            finish('cancelled')
          },
        })
      }
      await response.body?.cancel().catch(() => {})
      clearTimeout(timer)
      console.warn('[RAG] External LLM unavailable; using local generator. HTTP', response.status)
    } catch {
      clearTimeout(timer)
      signal?.throwIfAborted()
      console.warn('[RAG] External LLM connection failed; using local generator')
    }
  }

  // 2. Local fallback: only summarize retrieved facts. It must stay current with CMS edits.
  const generatedAnswer = buildLocalRAGAnswer(userMessage, retrievalResults, isJdMatch)

  // Create a ReadableStream delivering standard SSE formatted tokens
  let locallyCancelled = false
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // 1. Send Evidence Event
      const initialMeta = `event: meta\ndata: ${JSON.stringify({ evidence: evidenceTags, sources, isJdMatch, generator: 'local' })}\n\n`
      controller.enqueue(encoder.encode(initialMeta))

      // 2. Chunk and stream text with signal.aborted interruption check
      const chunkSize = 28
      for (let i = 0; i < generatedAnswer.length; i += chunkSize) {
        if (signal?.aborted || locallyCancelled) {
          if (!locallyCancelled) controller.close()
          return
        }
        const textChunk = generatedAnswer.slice(i, i + chunkSize)
        const sseEvent = `event: text\ndata: ${JSON.stringify({ text: textChunk })}\n\n`
        controller.enqueue(encoder.encode(sseEvent))
        await new Promise((resolve) => setTimeout(resolve, 8))
      }

      if (signal?.aborted || locallyCancelled) {
        if (!locallyCancelled) controller.close()
        return
      }

      // 3. Send Done Event
      controller.enqueue(encoder.encode('event: done\ndata: {}\n\n'))
      controller.close()
    },
    cancel() { locallyCancelled = true },
  })

  return stream
}

export function buildLocalRAGAnswer(
  userMessage: string,
  retrievalResults: RetrievalResult[],
  isJdMatch = false,
): string {
  if (retrievalResults.length === 0) {
    return '这项信息目前没有收录在我的公开资料中。你可以查看作品和简历，或直接联系张锦鹏核实。'
  }

  const wantsJdMatch = isJdMatch || isJobMatchRequest(userMessage)
  const wantsProjectList = /项目|作品/.test(userMessage) && /哪些|几个|所有|都|做过|上线|列出|介绍/.test(userMessage)
  const relevantResults = wantsProjectList
    ? retrievalResults.filter((result) =>
        result.chunk.category === 'project' &&
        (!/(?:已经|已)上线|上线的项目/.test(userMessage) || /【状态】[^\n]*已上线/.test(result.chunk.content)),
      )
    : retrievalResults

  if (relevantResults.length === 0) {
    return '这次检索没有找到能够回答该问题的公开项目资料。请查看作品页，或直接联系张锦鹏核实。'
  }

  const selected = wantsProjectList || wantsJdMatch ? relevantResults : relevantResults.slice(0, 1)
  const intro = wantsJdMatch
    ? '根据目前公开的资料，我能提供这些相关经历供你对照岗位要求；资料没有覆盖的要求，我不能直接声称具备：'
    : wantsProjectList
      ? '目前检索到的相关公开项目：'
      : '根据目前公开的资料：'
  const facts = selected.map((result) => {
    const content = result.chunk.content.replace(/^【([^】\r\n]+)】[ \t]*/gm, '**$1：**')
    return `**${result.chunk.title}** [${retrievalResults.indexOf(result) + 1}]\n${content}`
  })
  return `${intro}\n\n${facts.join('\n\n')}\n\n如需更多细节，可以打开对应项目档案或与本人核实。`
}
