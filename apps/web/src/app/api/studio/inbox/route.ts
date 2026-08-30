import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import { parseRawMessageToReflection } from '@/features/studio/inbox-parser'
import { extractCandidateMemories } from '@/features/studio/memory-extractor'

import { z } from 'zod'

export const dynamic = 'force-dynamic'

const inboxPayloadSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty').max(5000, 'Message cannot exceed 5000 characters').optional(),
  text: z.string().min(1).max(5000).optional(),
  content: z.string().min(1).max(5000).optional(),
  senderId: z.string().max(100).optional(),
}).refine((data) => Boolean((data.message || data.text || data.content)?.trim()), {
  message: 'One of message, text, or content must be provided and non-empty',
})

/**
 * Webhook Ingestion API for WeChat / OpenClaw / Mobile Shortcuts.
 * Endpoint: POST /api/studio/inbox
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Secret Authentication
    const authHeader = req.headers.get('x-bot-secret') || req.headers.get('x-studio-token') || req.headers.get('authorization') || ''
    const expectedSecret = process.env.STUDIO_INBOX_SECRET || process.env.PAYLOAD_SECRET

    if (process.env.NODE_ENV === 'production' && !expectedSecret) {
      return NextResponse.json({ error: 'Server configuration error: Webhook secret not set' }, { status: 500 })
    }

    const cleanToken = authHeader.replace(/^Bearer\s+/i, '').trim()

    if (cleanToken !== (expectedSecret || 'jaxson_studio_secret_2026')) {
      return NextResponse.json({ error: 'Unauthorized webhook request' }, { status: 401 })
    }

    // 2. Parse & Validate Body
    const rawBody = await req.json().catch(() => ({}))
    const parsed = inboxPayloadSchema.safeParse(rawBody)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid inbox payload format', details: parsed.error.issues },
        { status: 400 }
      )
    }

    const rawMessage = (parsed.data.message || parsed.data.text || parsed.data.content || '').trim()

    // 3. Extract Reflection & Candidate Memories
    const reflection = parseRawMessageToReflection(rawMessage)
    const candidates = extractCandidateMemories(reflection)

    // 4. Persist to Database (Payload CMS with Rollback on Failure)
    let reflectionDocId: string | undefined
    const createdMemoryIds: string[] = []
    try {
      const payload = await getPayload({ config: configPromise })

      // Create reflection log
      const refDoc = await payload.create({
        collection: 'reflections',
        data: {
          title: reflection.title,
          type: reflection.type,
          date: reflection.date,
          content: reflection.content,
          challenges: reflection.challenges,
          solution: reflection.solution,
        },
      })
      reflectionDocId = String(refDoc.id)

      // Create candidate memory items
      for (const item of candidates) {
        const memDoc = await payload.create({
          collection: 'memories',
          data: {
            title: item.title,
            category: item.category,
            status: 'candidate', // Strictly candidate until human approved
            content: item.content,
            evidenceTag: item.evidenceTag,
            confidence: item.confidence,
            sourceReflectionId: reflectionDocId,
            tags: item.tags,
          },
        })
        createdMemoryIds.push(String(memDoc.id))
      }
    } catch (dbErr: any) {
      const reqId = `webhook_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
      // Rollback on partial failure
      try {
        const payload = await getPayload({ config: configPromise })
        for (const memId of createdMemoryIds) {
          await payload.delete({ collection: 'memories', id: memId }).catch(() => {})
        }
        if (reflectionDocId) {
          await payload.delete({ collection: 'reflections', id: reflectionDocId }).catch(() => {})
        }
      } catch {
        // Ignore rollback failure
      }

      if (process.env.NODE_ENV === 'production') {
        console.error(`[Studio Inbox][${reqId}] Database persistence failed in production:`, dbErr)
        return NextResponse.json(
          { error: 'Failed to persist reflection to database', requestId: reqId },
          { status: 500 }
        )
      }
      console.warn('[Studio Inbox] Database persistence skipped in offline/test environment:', dbErr?.message)
    }

    // 5. Format WeChat Friendly Reply
    const allTags = Array.from(new Set(candidates.flatMap((c) => c.tags)))
    const tagsStr = allTags.length > 0 ? allTags.map((t) => `#${t}`).join(' ') : '#技术复盘'

    const wechatReply = `🧠 【复盘大脑已接收】
• 主题：${reflection.title}
• 提炼：已提取 ${candidates.length} 条事实证据候选
• 标签：${tagsStr}
• 状态：已存入待确认看板 (请登录 Web 端审批)

(若想转为待办事项，回复「转待办」)`

    return NextResponse.json({
      success: true,
      reply: wechatReply,
      reflectionId: reflectionDocId,
      extractedCount: candidates.length,
      reflection,
      candidates,
    })
  } catch (error: any) {
    const reqId = `inbox_err_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
    console.error(`[API /api/studio/inbox][${reqId}] Error processing incoming message:`, error)
    return NextResponse.json(
      { error: 'Internal server error processing inbox reflection', requestId: reqId },
      { status: 500 }
    )
  }
}
