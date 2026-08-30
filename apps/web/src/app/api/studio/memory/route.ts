import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import {
  extractCandidateMemories,
  type CandidateMemory,
  type ReflectionInput,
} from '@/features/studio/memory-extractor'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })

    // Fetch reflections and memories from Payload CMS
    let reflections: any[] = []
    let candidateMemories: any[] = []
    let approvedMemories: any[] = []

    try {
      const refRes = await payload.find({
        collection: 'reflections',
        limit: 50,
        sort: '-date',
      })
      reflections = refRes.docs
    } catch (e) {
      console.warn('[Studio API] Failed to fetch reflections from CMS:', e)
    }

    try {
      const memRes = await payload.find({
        collection: 'memories',
        limit: 100,
        sort: '-updatedAt',
      })
      const normalizeDoc = (d: any) => ({
        ...d,
        tags: Array.isArray(d.tags)
          ? d.tags.map((t: any) => (typeof t === 'string' ? t : t?.tag || '')).filter(Boolean)
          : [],
      })
      candidateMemories = memRes.docs.filter((d: any) => d.status === 'candidate').map(normalizeDoc)
      approvedMemories = memRes.docs.filter((d: any) => d.status === 'approved').map(normalizeDoc)
    } catch (e) {
      console.warn('[Studio API] Failed to fetch memories from CMS:', e)
    }

    // Default Seed Memories fallback if database was recently initialized
    if (approvedMemories.length === 0 && candidateMemories.length === 0) {
      approvedMemories = [
        {
          id: 'seed-mem-1',
          title: '企业实战：广东润喵云算力平台大屏防抖与微服务联调',
          category: 'internship_business',
          status: 'approved',
          content: '【业务场景】在广东润喵云实习期间，负责算力租赁管理后台与大屏监控看板的前端交互实现与组件封装。\n【攻坚突破】配合 Go 后端微服务完成高并发接口联调，引入动态防抖与状态锁，将大屏状态抖动降低了 40%。',
          evidenceTag: '广东润喵云科技有限公司 · 全栈开发实习生证明',
          confidence: 0.98,
          tags: ['Vue 3', 'Go', '算力平台', '高并发', '防抖'],
        },
        {
          id: 'seed-mem-2',
          title: '核心交付：Todo Memo PWA 离线缓存与 Supabase 实时同步',
          category: 'project_experience',
          status: 'approved',
          content: '【技术方案】独立设计并交付了 Todo Memo PWA 应用，围绕“极速收集、场景分组、离线可用和云端持久化”构建，通过 Service Worker 与 Supabase 实现弱网下的无损数据流闭环。',
          evidenceTag: 'Todo Memo PWA 核心项目发布记录',
          confidence: 0.96,
          tags: ['React', 'TypeScript', 'Supabase', 'PWA', 'Tailwind CSS'],
        },
        {
          id: 'seed-mem-3',
          title: '开源贡献：锐历简历本土化中文字体排版与双向预览',
          category: 'project_experience',
          status: 'approved',
          content: '【技术方案】二次开发海外简历开源项目，重构中文排版规范与样式层级，深度攻克了浏览器端 A4 换页断行与字体适配问题，已在 GitHub 开源。',
          evidenceTag: '锐历简历工作台开源贡献记录',
          confidence: 0.95,
          tags: ['React', 'TypeScript', '中文排版引擎', 'PDF 渲染', '开源二次开发'],
        },
        {
          id: 'seed-mem-4',
          title: '学业与竞赛：深职大大数据技术 (GPA 3.67 前 5%) 与国赛/省赛奖项',
          category: 'architecture_thinking',
          status: 'approved',
          content: '【在校经历】深圳职业技术大学大数据技术专业（GPA 3.67/4.0 前 5%），连续获得校级一等学业奖学金；获全国大学生计算机系统与软件创新大赛国家级二等奖、广东省大学生程序设计技能竞赛省级一等奖。',
          evidenceTag: '深职大学业成绩单与国家级/省级竞赛获奖证书',
          confidence: 0.99,
          tags: ['GPA 前 5%', '国家级二等奖', '省赛一等奖', '深职大'],
        },
      ]

      candidateMemories = [
        {
          id: 'seed-cand-1',
          title: '技术攻坚：Next.js 16 + Payload CMS 3.x 嵌入式双 Schema 隔离',
          category: 'architecture_thinking',
          status: 'candidate',
          content: '【难点与场景】如何确保公开端 AI 即使遭遇 Prompt Injection 也无法越权读取私人复盘。\n【架构决策】在 PostgreSQL 层面建立 owner（私有）与 public_read（只读快照）双角色物理隔离。',
          evidenceTag: 'Jaxson Space 系统架构演进复盘',
          confidence: 0.94,
          tags: ['Next.js 16', 'Payload CMS', 'PostgreSQL', '物理隔离', '安全性'],
        },
      ]
    }

    return NextResponse.json({
      success: true,
      reflections,
      candidateMemories,
      approvedMemories,
    })
  } catch (error: any) {
    console.error('[Studio API] Error fetching data:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch studio data' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const action = body.action || 'submit_reflection'
    const payload = await getPayload({ config: configPromise })

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

      // Save reflection in CMS
      let savedReflection: any
      try {
        savedReflection = await payload.create({
          collection: 'reflections',
          data: {
            title: normalizedReflection.title,
            type: normalizedReflection.type,
            date: normalizedReflection.date,
            content: normalizedReflection.content,
            challenges: normalizedReflection.challenges,
            solution: normalizedReflection.solution,
            takeaways: normalizedReflection.takeaways,
            nextSteps: normalizedReflection.nextSteps,
            extractionStatus: 'extracted',
          },
        })
      } catch (err: any) {
        console.error('[Studio API] Failed to save reflection to database:', err)
        return NextResponse.json(
          { success: false, error: `保存复盘失败: ${err?.message || '数据库写入异常'}` },
          { status: 500 }
        )
      }

      // Extract candidate memories using normalized reflection
      const candidates = extractCandidateMemories({
        ...normalizedReflection,
        id: String(savedReflection.id),
      })

      // Save candidate memories into CMS with Rollback on Failure
      const savedCandidates: any[] = []
      for (const cand of candidates) {
        try {
          const doc = await payload.create({
            collection: 'memories',
            data: {
              title: cand.title,
              category: cand.category,
              status: 'candidate',
              content: cand.content,
              evidenceTag: cand.evidenceTag,
              confidence: cand.confidence,
              sourceReflectionId: String(savedReflection.id),
              tags: cand.tags,
            },
          })
          savedCandidates.push(doc)
        } catch (e: any) {
          console.error('[Studio API] Failed to save candidate memory, executing rollback:', e)
          // Rollback created candidate memories and reflection
          for (const s of savedCandidates) {
            await payload.delete({ collection: 'memories', id: s.id }).catch(() => {})
          }
          await payload.delete({ collection: 'reflections', id: savedReflection.id }).catch(() => {})

          return NextResponse.json(
            { success: false, error: `保存候选记忆条目失败: ${e?.message || '数据库写入异常'}` },
            { status: 500 }
          )
        }
      }

      return NextResponse.json({
        success: true,
        message: `复盘已保存，并提炼出 ${candidates.length} 条待确认候选记忆！`,
        reflection: savedReflection,
        candidates: savedCandidates,
      })
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
          message: '已成功转为正式长期记忆！',
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
