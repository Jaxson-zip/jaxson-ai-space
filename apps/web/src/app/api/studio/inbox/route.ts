import { createHash, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import { z } from 'zod'
import configPromise from '@/payload.config'
import { parseRawMessageToReflection } from '@/features/studio/inbox-parser'
import { extractCandidateMemories } from '@/features/studio/memory-extractor'
import { inboxIdentities } from '@/features/studio/inbox-identities'
import { studioTransaction } from '@/features/studio/transaction'

export const dynamic = 'force-dynamic'
const id = z.string().trim().min(1).max(200)
const schema = z.object({
  message: z.string().trim().min(1).max(5000),
  channelId: id, accountId: id, senderId: id, conversationId: id, messageId: id,
})
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const failure = (error: string, status: number) => NextResponse.json({ success: false, error }, { status })

export async function POST(req: NextRequest) {
  const secret = process.env.STUDIO_INBOX_SECRET?.trim()
  if (!secret) return failure('Inbox secret is not configured', 503)
  const token = (req.headers.get('x-studio-token') || req.headers.get('x-bot-secret') || req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!timingSafeEqual(Buffer.from(hash(token)), Buffer.from(hash(secret)))) return failure('Unauthorized', 401)
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return failure('Message, sender, channel, account, conversation and message IDs are required', 400)
  const allowed = inboxIdentities(process.env.STUDIO_INBOX_ALLOWED_IDENTITIES)
  if (!allowed) return failure('Inbox sender allowlist is not configured', 503)
  const input = parsed.data
  if (!allowed.some((entry) => entry.channelId === input.channelId && entry.accountId === input.accountId && entry.senderId === input.senderId)) {
    return failure('Sender is not allowed', 403)
  }
  const key = hash(JSON.stringify([input.channelId, input.accountId, input.senderId, input.conversationId, input.messageId]))
  const digest = hash(input.message)
  try {
    const payload = await getPayload({ config: configPromise })
    const lookup = async () => (await payload.find({ collection: 'reflections', where: { inboxKey: { equals: key } }, limit: 1, depth: 0 })).docs[0]
    const replay = (doc: NonNullable<Awaited<ReturnType<typeof lookup>>>) => doc.inboxDigest !== digest
      ? failure('Message ID was already used for different content', 409)
      : NextResponse.json({ success: true, duplicate: true, reflectionId: String(doc.id), reply: doc.inboxReply, extractedCount: doc.inboxCount })
    const existing = await lookup()
    if (existing) return replay(existing)
    const reflection = parseRawMessageToReflection(input.message)
    const candidates = extractCandidateMemories(reflection)
    const reply = `复盘已保存：${reflection.title}\n已提炼 ${candidates.length} 条候选记忆，等待你在私人工作台确认。\n不会自动公开给 AI 访客。`
    try {
      const saved = await studioTransaction(payload, async (txReq) => {
        const doc = await payload.create({ collection: 'reflections', req: txReq, data: {
          title: reflection.title, type: reflection.type, date: reflection.date, content: reflection.content,
          challenges: reflection.challenges, solution: reflection.solution, extractionStatus: 'extracted',
          inboxKey: key, inboxDigest: digest, inboxReply: reply, inboxCount: candidates.length,
        } })
        for (const item of candidates) {
          await payload.create({ collection: 'memories', req: txReq, data: {
            title: item.title, category: item.category, status: 'candidate', content: item.content,
            evidenceTag: item.evidenceTag, confidence: item.confidence, sourceReflectionId: String(doc.id), tags: item.tags,
          } })
        }
        return doc
      })
      return NextResponse.json({ success: true, duplicate: false, reflectionId: String(saved.id), reply, extractedCount: candidates.length })
    } catch (error) {
      // Concurrent deliveries race on the unique key. Only a committed receipt may be replayed.
      const concurrent = await lookup()
      if (concurrent) return replay(concurrent)
      throw error
    }
  } catch (error) {
    console.error('[Studio Inbox] Persistence failed:', error)
    return failure('复盘未确认保存，请使用同一消息 ID 重试。', 503)
  }
}
