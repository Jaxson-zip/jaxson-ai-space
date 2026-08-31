import { NextRequest, NextResponse } from 'next/server'
import { loadKnowledgeChunks } from '@/features/ai/rag/knowledge-loader'
import { hybridRetrieve } from '@/features/ai/rag/retriever'
import { createRAGStream } from '@/features/ai/rag/llm-stream'

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

export async function POST(req: NextRequest) {
  try {
    // 0. Extract Client IP and verify Rate Limit
    const clientIp =
      req.headers.get('cf-connecting-ip') ||
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip') ||
      '127.0.0.1'

    if (!checkRateLimit(clientIp)) {
      return NextResponse.json(
        { error: 'Too Many Requests: Chat rate limit exceeded. Please wait a minute.' },
        { status: 429 }
      )
    }

    const rawBody = await req.json().catch(() => ({}))
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
    const latestQuery = latestMsg.content.trim()

    // 1. Load dynamic knowledge chunks from Payload CMS & portfolio content
    const allChunks = await loadKnowledgeChunks(latestQuery)

    // 2. Perform hybrid retrieval (Vector Cosine Similarity + BM25)
    const retrievalResults = hybridRetrieve(latestQuery, allChunks, 3)

    // 3. Create real-time streaming response with AbortSignal
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

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'x-rag-engine': 'hybrid-in-memory-v1',
      },
    })
  } catch (error: any) {
    const requestId = `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
    console.error(`[API /api/chat][${requestId}] Error handling chat request:`, error)
    return NextResponse.json(
      { error: 'Internal server error in RAG engine', requestId },
      { status: 500 }
    )
  }
}
