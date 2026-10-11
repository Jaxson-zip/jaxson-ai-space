import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import { studioTransaction } from '@/features/studio/transaction'
import {
  extractCandidateMemories,
  type ReflectionInput,
} from '@/features/studio/memory-extractor'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const payload = await getPayload({ config: configPromise })
    const [reflections, memories] = await Promise.all([
      payload.find({ collection: 'reflections', pagination: false, sort: '-date', depth: 0 }),
      payload.find({ collection: 'memories', pagination: false, sort: '-updatedAt', depth: 0 }),
    ])
    const normalized = memories.docs.map((doc) => ({
      ...doc,
      tags: Array.isArray(doc.tags)
        ? doc.tags.filter((tag): tag is string => typeof tag === 'string')
        : [],
    }))
    return NextResponse.json({
      success: true,
      reflections: reflections.docs,
      candidateMemories: normalized.filter((doc) => doc.status === 'candidate'),
      approvedMemories: normalized.filter((doc) => doc.status === 'approved'),
    })
  } catch (error) {
    console.error('[Studio API] Failed to fetch private data:', error)
    return NextResponse.json(
      { success: false, error: '私人工作台数据暂时不可用，请稍后重试。' },
      { status: 503 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const action = body.action || 'submit_reflection'
    const payload = await getPayload({ config: configPromise })

    if (action === 'create_knowledge_draft') {
      const memoryId = body.memoryId
      if (typeof memoryId !== 'string' || !memoryId.trim()) {
        return NextResponse.json({ success: false, error: '缺少 memoryId' }, { status: 400 })
      }
      const memory = await payload.findByID({ collection: 'memories', id: memoryId, depth: 0 })
      if (memory.status !== 'approved') {
        return NextResponse.json({ success: false, error: '请先人工确认这条私人记忆。' }, { status: 409 })
      }
      const privateMemoryKey = createHash('sha256').update(`memory:${memory.id}`).digest('hex')
      const lookup = async () => (await payload.find({ collection: 'ai-knowledge', where: { privateMemoryKey: { equals: privateMemoryKey } }, limit: 1, depth: 0 })).docs[0]
      let draft = await lookup()
      if (!draft) {
        try {
          draft = await payload.create({ collection: 'ai-knowledge', data: {
            title: memory.title, content: memory.content, evidenceTag: memory.evidenceTag,
            category: memory.category === 'internship_business' ? 'internship' : memory.category === 'project_experience' ? 'project' : 'skill',
            isPublic: false, privateMemoryKey,
          } })
        } catch (error) {
          draft = await lookup()
          if (!draft) throw error
        }
      }
      return NextResponse.json({ success: true, knowledgeId: String(draft.id), editUrl: `/admin/collections/ai-knowledge/${draft.id}` })
    }

    // 1. Submit a new reflection and extract candidate memories
    if (action === 'submit_reflection') {
      const reflectionData: ReflectionInput = body.reflection
      if (!reflectionData || !reflectionData.title || !reflectionData.content) {
        return NextResponse.json(
          { success: false, error: '复盘主题与内容为必填项' },
          { status: 400 }
        )
      }

      // Pre-normalize input data to prevent undefined dates / evidence tags
      const normalizedDate = (reflectionData.date || new Date().toISOString().slice(0, 10)).trim()
      const normalizedReflection: ReflectionInput = {
        title: reflectionData.title.trim(),
        type: reflectionData.type || 'daily',
        date: normalizedDate,
        content: reflectionData.content.trim(),
        challenges: reflectionData.challenges || '',
        solution: reflectionData.solution || '',
        takeaways: reflectionData.takeaways || '',
        nextSteps: reflectionData.nextSteps || '',
      }

      try {
        const result = await studioTransaction(payload, async (txReq) => {
          const savedReflection = await payload.create({
            collection: 'reflections', req: txReq,
            data: {
              title: normalizedReflection.title, type: normalizedReflection.type,
              date: normalizedReflection.date, content: normalizedReflection.content,
              challenges: normalizedReflection.challenges, solution: normalizedReflection.solution,
              takeaways: normalizedReflection.takeaways, nextSteps: normalizedReflection.nextSteps,
              extractionStatus: 'extracted',
            },
          })
          const candidates = extractCandidateMemories({ ...normalizedReflection, id: String(savedReflection.id) })
          const savedCandidates = []
          for (const candidate of candidates) {
            savedCandidates.push(await payload.create({ collection: 'memories', req: txReq, data: {
              title: candidate.title, category: candidate.category, status: 'candidate', content: candidate.content,
              evidenceTag: candidate.evidenceTag, confidence: candidate.confidence,
              sourceReflectionId: String(savedReflection.id), tags: candidate.tags,
            } }))
          }
          return { reflection: savedReflection, candidates: savedCandidates }
        })
        return NextResponse.json({ success: true, message: '复盘与候选记忆已保存，等待人工确认。', ...result })
      } catch (error) {
        console.error('[Studio Memory] Transaction failed:', error)
        return NextResponse.json({ success: false, error: '复盘保存失败，请稍后重试。' }, { status: 503 })
      }
    }

    // 2. Approve a candidate memory
    if (action === 'approve_candidate') {
      const memoryId = body.memoryId
      if (!memoryId) {
        return NextResponse.json({ success: false, error: '缺少 memoryId' }, { status: 400 })
      }

      try {
        const updated = await payload.update({
          collection: 'memories',
          id: memoryId,
          data: {
            status: 'approved',
          },
        })
        return NextResponse.json({
          success: true,
          message: '已确认并保存为私人记忆，不会自动公开。',
          memory: updated,
        })
      } catch (e: any) {
        console.error('[Studio Memory] Failed to approve memory:', e)
        return NextResponse.json(
          { success: false, error: `写入数据库失败: ${e?.message || '未知异常'}` },
          { status: 500 }
        )
      }
    }

    // 3. Edit & Approve candidate memory
    if (action === 'edit_and_approve') {
      const { memoryId, title, content, category, tags } = body
      if (!memoryId || !title || !content) {
        return NextResponse.json({ success: false, error: '参数不完整' }, { status: 400 })
      }

      try {
        const updated = await payload.update({
          collection: 'memories',
          id: memoryId,
          data: {
            title,
            content,
            category: category || 'project_experience',
            tags: tags || [],
            status: 'approved',
          },
        })
        return NextResponse.json({
          success: true,
          message: '修改并确认入库成功！',
          memory: updated,
        })
      } catch (e: any) {
        console.error('[Studio Memory] Failed to edit and approve memory:', e)
        return NextResponse.json(
          { success: false, error: `更新记忆失败: ${e?.message || '未知异常'}` },
          { status: 500 }
        )
      }
    }

    // 4. Reject / Delete candidate or approved memory
    if (action === 'reject_candidate' || action === 'delete_approved') {
      const memoryId = body.memoryId
      if (!memoryId) {
        return NextResponse.json({ success: false, error: '缺少 memoryId' }, { status: 400 })
      }

      try {
        await payload.delete({
          collection: 'memories',
          id: memoryId,
        })
        return NextResponse.json({ success: true, message: '已成功删除该记忆条目。' })
      } catch (e: any) {
        console.error('[Studio Memory] Failed to delete memory:', e)
        return NextResponse.json(
          { success: false, error: `删除记忆失败: ${e?.message || '未知异常'}` },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ success: false, error: '未知 action' }, { status: 400 })
  } catch (error: any) {
    console.error('[Studio API POST] Error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Server error' },
      { status: 500 }
    )
  }
}
