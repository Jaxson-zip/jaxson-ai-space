import { NextRequest, NextResponse } from 'next/server'
import { loadKnowledgeChunks } from '@/features/ai/rag/knowledge-loader'
import { groundedRetrieve } from '@/features/ai/rag/retriever'
import { createRAGStream } from '@/features/ai/rag/llm-stream'
import { clientIpFrom } from '@/features/ai/client-ip'
import { readChatBody, ChatBodyError } from '@/features/ai/request-body'
import { acquireChatSlot, trackChatStream } from '@/features/ai/chat-capacity'
import { allowPortfolioOrigin, portfolioPreflight } from '@/features/portfolio/cors'

import { z } from 'zod'

export const dynamic = 'force-dynamic'

// In-memory sliding window rate limiter (20 requests per minute per IP)
const ipRateMap = new Map<string, number[]>()
const RATE_LIMIT_WINDOW_MS = 60 * 1000
const MAX_REQUESTS_PER_WINDOW = 20

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const timestamps = ipRateMap.get(ip) || []
  const validTimestamps = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS)

  if (validTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    return false
  }

  validTimestamps.push(now)
  ipRateMap.set(ip, validTimestamps)

  // Periodic memory cleanup
  if (ipRateMap.size > 2000) {
    for (const [key, times] of ipRateMap.entries()) {
      if (times.every((t) => now - t >= RATE_LIMIT_WINDOW_MS)) {
        ipRateMap.delete(key)
      }
    }
  }

  return true
}

const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(2500),
})

const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(10),
  isJdMatch: z.boolean().optional(),
})

// The home page on jaxson.bond asks from the browser, so the visitor's own IP still reaches the rate limit.
export async function OPTIONS(req: NextRequest) {
  return portfolioPreflight(req, 'POST, OPTIONS')
}

export async function POST(req: NextRequest) {
  const response = await answer(req)
  allowPortfolioOrigin(response.headers, req.headers.get('origin'))
  return response
}

async function answer(req: NextRequest): Promise<Response> {
  let stage = 'validation'
  const started = performance.now()
  let release: (() => void) | undefined
  try {
    // 0. Extract Client IP and verify Rate Limit
    if (!checkRateLimit(clientIpFrom(req.headers))) {
      return NextResponse.json(
        { error: 'Too Many Requests: Chat rate limit exceeded. Please wait a minute.' },
        {
          status: 429,
          headers: {
            'Retry-After': '60',
          },
        }
      )
    }

    let rawBody: unknown
    try { rawBody = await readChatBody(req) }
    catch (error) {
      if (error instanceof ChatBodyError) return NextResponse.json({ error: error.message }, { status: error.status })
      throw error
    }
    const parsed = chatRequestSchema.safeParse(rawBody)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid chat payload format', details: parsed.error.issues },
        { status: 400 }
      )
    }

    const { messages, isJdMatch } = parsed.data

    // Check total conversation character length budget
    const totalChars = messages.reduce((acc, m) => acc + m.content.length, 0)
    if (totalChars > 8000) {
      return NextResponse.json(
        { error: 'Total message content exceeds maximum allowed limit of 8000 characters' },
        { status: 400 }
      )
    }

    const latestMsg = messages[messages.length - 1]
    if (latestMsg.role !== 'user' || !latestMsg.content.trim()) {
      return NextResponse.json({ error: 'The last message must be a user question' }, { status: 400 })
    }
    const latestQuery = latestMsg.content.trim()
    release = acquireChatSlot()
    if (!release) return NextResponse.json({ error: 'Chat service busy. Please retry shortly.' }, { status: 503, headers: { 'Retry-After': '5' } })

    // 1. Load dynamic knowledge chunks from Payload CMS & portfolio content
    stage = 'knowledge'
    const knowledgeStarted = performance.now()
    const allChunks = await loadKnowledgeChunks(latestQuery)
    const knowledgeMs = performance.now() - knowledgeStarted
    req.signal.throwIfAborted()

    // 2. Perform hybrid retrieval (Vector Cosine Similarity + BM25)
    stage = 'retrieval'
    const retrievalStarted = performance.now()
    const retrievalResults = groundedRetrieve(latestQuery, allChunks, 5)
    const retrievalMs = performance.now() - retrievalStarted

    // 3. Create real-time streaming response with AbortSignal
    stage = 'provider'
    const providerStarted = performance.now()
    const stream = await createRAGStream({
      messages: messages.map((m, idx) => ({
        id: `msg-${idx}`,
        role: m.role,
        content: m.content,
      })),
      retrievalResults,
      isJdMatch,
      signal: req.signal,
    })

    const response = new Response(trackChatStream(stream, release, req.signal), {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'x-rag-engine': 'hybrid-in-memory-v1',
        'Server-Timing': `knowledge;dur=${knowledgeMs.toFixed(1)}, retrieval;dur=${retrievalMs.toFixed(1)}, provider;dur=${(performance.now() - providerStarted).toFixed(1)}, setup;dur=${(performance.now() - started).toFixed(1)}`,
      },
    })
    release = undefined // The response stream now owns the slot through EOF, error or cancellation.
    return response
  } catch {
    if (req.signal.aborted) return new Response(null, { status: 499 })
    const requestId = `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
    console.error('[API /api/chat] Request failed', { requestId, stage })
    return NextResponse.json(
      { error: 'Internal server error in RAG engine', requestId },
      { status: 500 }
    )
  } finally { release?.() }
}
