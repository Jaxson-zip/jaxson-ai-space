import type { ChatMessage, RetrievalResult } from './types'
import { buildSystemPrompt } from './prompt-builder'

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
  const { messages, retrievalResults, isJdMatch, signal } = config
  const encoder = new TextEncoder()

  const systemPrompt = buildSystemPrompt(retrievalResults, isJdMatch)
  const userMessage = messages[messages.length - 1]?.content || ''

  // 1. Check for external LLM API configurations
  const deepseekKey = process.env.DEEPSEEK_API_KEY
  const dashscopeKey = process.env.DASHSCOPE_API_KEY
  const openaiKey = process.env.OPENAI_API_KEY

  const apiKey = deepseekKey || dashscopeKey || openaiKey
  const baseUrl = deepseekKey
    ? (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1')
    : dashscopeKey
    ? (process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1')
    : (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1')
  const model = deepseekKey
    ? 'deepseek-chat'
    : dashscopeKey
    ? 'qwen-plus'
    : (process.env.OPENAI_MODEL || 'gpt-4o-mini')

  const evidenceTags = retrievalResults.map((r) => r.chunk.evidenceTag)

  // If a live LLM API key is present, stream and transform from the provider
  if (apiKey) {
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
        }),
        signal,
      })

      if (response.ok && response.body) {
        const upstreamReader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        return new ReadableStream<Uint8Array>({
          async start(controller) {
            // 1. Emit evidence meta first
            const initialMeta = `event: meta\ndata: ${JSON.stringify({ evidence: evidenceTags, isJdMatch })}\n\n`
            controller.enqueue(encoder.encode(initialMeta))

            try {
              while (true) {
                const { done, value } = await upstreamReader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                  const trimmed = line.trim()
                  if (!trimmed || trimmed.startsWith(':')) continue
                  if (trimmed === 'data: [DONE]') {
                    controller.enqueue(encoder.encode('event: done\ndata: {}\n\n'))
                    controller.close()
                    return
                  }

                  if (trimmed.startsWith('data: ')) {
                    try {
                      const json = JSON.parse(trimmed.slice(6))
                      const delta = json.choices?.[0]?.delta?.content || ''
                      if (delta) {
                        const sseEvent = `event: text\ndata: ${JSON.stringify({ text: delta })}\n\n`
                        controller.enqueue(encoder.encode(sseEvent))
                      }
                    } catch {
                      // Skip partial or unparsable JSON lines
                    }
                  }
                }
              }
              controller.enqueue(encoder.encode('event: done\ndata: {}\n\n'))
              controller.close()
            } catch (streamErr) {
              console.error('[RAG] Error reading external LLM stream:', streamErr)
              controller.error(streamErr)
            }
          },
        })
      }
      console.warn('[RAG] External LLM error, falling back to built-in generator:', response.statusText)
    } catch (err) {
      console.warn('[RAG] External LLM network issue, falling back to built-in generator:', err)
    }
  }

  // 2. Built-in Deterministic RAG Response Generator (100% Offline / Zero-Key Fallback)
  let generatedAnswer = ''

  if (isJdMatch || userMessage.toLowerCase().includes('jd') || userMessage.includes('岗位') || userMessage.includes('招聘') || userMessage.includes('要求')) {
    const matchedSkills = retrievalResults
      .flatMap((r) => r.chunk.keywords)
      .filter((k) => userMessage.toLowerCase().includes(k.toLowerCase()))

    const uniqueMatches = Array.from(new Set(matchedSkills))
    const matchingContext = uniqueMatches.length > 0 ? `（匹配到技术关键词：${uniqueMatches.join('、')}）` : ''

    generatedAnswer = `从你发来的岗位需求与技术方向来看 ${matchingContext}，我的技术背景主要聚焦在 **Web 全栈开发** 与 **AI 应用落地**。结合我真实的实习与项目经历，向你实事求是地介绍我的情况：

### 1. 我的技术栈与核心交付
- **前端与全栈工程**：我的主力开发技术栈是 **React 19、TypeScript、Vue 3 与 Next.js**，注重强类型规范、组件化与自动化测试；在后端与数据层熟悉 **Go 接口联调、PostgreSQL 与 Supabase**；
- **企业实战经历（广东润喵云科技）**：在润喵云实习期间，我参与了算力管理后台与大屏监控模块的前端交互实现与组件封装，配合 Go 后端微服务完成高并发接口联调与状态防抖处理；
- **独立完整产品交付**：我独立设计并上线了 **Todo Memo PWA**（支持离线缓存与云端同步）、**锐历简历**（中文化排版优化开源项目）。

### 2. 学习能力与工程素养
- **学业与竞赛**：我目前就读于深圳职业技术大学大数据技术专业（GPA 3.67 前 5%），曾获得 **国家级二等奖** 与 **省级一等奖**；
- **工程协同流**：日常深度使用 Git Worktree、Cursor、CI/CD 自动化构建提升交付效率，学习吸收新技术快，具备很强的自驱力。

### 3. 到岗时间与交流
我目前常驻深圳，随时可以线下到岗实习或工作。如果你需要查看项目源码、在线体验 Demo 或安排面试，随时欢迎加我的微信 **15347640609**，或发送邮件至 **1822103245@qq.com**！`
  } else {
    const topChunk = retrievalResults[0]?.chunk
    const topContent = topChunk?.content || ''

    if (topChunk) {
      generatedAnswer = `关于【${topChunk.title}】的真实情况与技术实现：

${topContent}

我在开发该模块时，始终坚持“以真实场景痛点为导向、以工程可维护性为底线”，代码与架构均经过严格测试。如果你想深入了解我的实现细节或在线体验 Demo，欢迎随时提问，或直接加我的微信 **15347640609** 交流！`
    } else {
      generatedAnswer = `你好！我是张锦鹏 (Jaxson) 的 AI 数字分身。

我目前就读于**深圳职业技术大学**大数据技术专业（GPA 3.67 前 5%），主修前端全栈与 AI 应用开发。

你可以向我了解我在 **广东润喵云的实习经历**、**核心交付项目（Todo Memo、锐历简历）**、**竞赛荣誉**，或者直接把贵司的岗位 JD 需求发给我，我来帮你做针对性契合度分析！`
    }
  }

  // Create a ReadableStream delivering standard SSE formatted tokens
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // 1. Send Evidence Event
      const evidenceTags = retrievalResults.map((r) => r.chunk.evidenceTag)
      const initialMeta = `event: meta\ndata: ${JSON.stringify({ evidence: evidenceTags, isJdMatch })}\n\n`
      controller.enqueue(encoder.encode(initialMeta))

      // 2. Chunk and stream text with signal.aborted interruption check
      const chunkSize = 6
      for (let i = 0; i < generatedAnswer.length; i += chunkSize) {
        if (signal?.aborted) {
          controller.close()
          return
        }
        const textChunk = generatedAnswer.slice(i, i + chunkSize)
        const sseEvent = `event: text\ndata: ${JSON.stringify({ text: textChunk })}\n\n`
        controller.enqueue(encoder.encode(sseEvent))
        await new Promise((resolve) => setTimeout(resolve, 20))
      }

      if (signal?.aborted) {
        controller.close()
        return
      }

      // 3. Send Done Event
      controller.enqueue(encoder.encode('event: done\ndata: {}\n\n'))
      controller.close()
    },
  })

  return stream
}
