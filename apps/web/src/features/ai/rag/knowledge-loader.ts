import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import { awards, experiences, profile, projects, skillGroups } from '@/features/portfolio/content'
import type { ChunkCategory, KnowledgeChunk } from './types'

export async function loadKnowledgeChunks(): Promise<KnowledgeChunk[]> {
  const chunks: KnowledgeChunk[] = []

  // 1. Try querying PostgreSQL public_read.knowledge_embeddings snapshot
  if (process.env.USE_POSTGRES === 'true' && (process.env.DATABASE_URI || process.env.PUBLIC_AGENT_DATABASE_URI)) {
    try {
      const pgModule = await import('pg' as any).catch(() => null)
      if (pgModule && (pgModule.Pool || pgModule.default?.Pool)) {
        const PoolClass = pgModule.Pool || pgModule.default.Pool
        const connStr = process.env.PUBLIC_AGENT_DATABASE_URI || process.env.DATABASE_URI
        const pool = new PoolClass({ connectionString: connStr, max: 2, idleTimeoutMillis: 5000 })
        const res = await pool.query(`
          SELECT chunk_id, category, title, content, evidence_tag, metadata 
          FROM public_read.knowledge_embeddings 
          ORDER BY updated_at DESC LIMIT 100
        `)
        await pool.end().catch(() => {})
        if (res && res.rows && res.rows.length > 0) {
          for (const row of res.rows) {
            chunks.push({
              id: row.chunk_id,
              title: row.title,
              category: (row.category || 'general') as ChunkCategory,
              content: row.content,
              evidenceTag: row.evidence_tag,
              keywords: [row.title, row.category, row.evidence_tag].filter(Boolean),
            })
          }
        }
      }
    } catch (pgErr) {
      console.warn('[RAG] Unable to query public_read pgvector knowledge directly, trying CMS collections:', pgErr)
    }
  }

  // 2. Try to load public Q&A / knowledge entries from Payload CMS
  if (chunks.length === 0) {
    try {
      const payload = await getPayload({ config: configPromise })
      const aiKnowledgeDocs = await payload.find({
        collection: 'ai-knowledge',
        limit: 100,
        where: {
          isPublic: {
            equals: true,
          },
        },
      })

      if (aiKnowledgeDocs.totalDocs > 0) {
        for (const doc of aiKnowledgeDocs.docs as any[]) {
          chunks.push({
            id: `cms-${doc.id}`,
            title: doc.title,
            category: doc.category || 'general',
            content: doc.content,
            evidenceTag: doc.evidenceTag || `知识库条目：${doc.title}`,
            keywords: [doc.title, doc.category, doc.evidenceTag].filter(Boolean),
          })
        }
      }
    } catch (err) {
      console.warn('[RAG] Unable to query CMS public collections, using core static facts:', err)
    }
  }

  // 2. Add Project Chunks (Strictly filter public projects only)
  for (const p of projects.filter((proj) => proj.sourceVisibility === 'public')) {
    chunks.push({
      id: `project-${p.slug}`,
      title: `项目：${p.title}`,
      category: 'project',
      content: `【项目背景】${p.problem}\n【技术方案】${p.approach}\n【交付结果】${p.outcome}\n【技术栈】${p.technologies.join('、')}\n【状态】${p.status}（公开开源）`,
      evidenceTag: `${p.title} 核心项目`,
      keywords: [p.title, p.slug, p.category, ...p.technologies, p.status],
    })
  }

  // 3. Add Experience Chunks (Properly distinguish internship, education, campus)
  for (const exp of experiences) {
    const expKind = String(exp.kind)
    const expCategory: ChunkCategory =
      expKind === 'internship' ? 'internship' : expKind === 'campus' ? 'campus' : 'education'
    const kindLabel =
      expKind === 'internship' ? '实习经历' : expKind === 'campus' ? '校园实践' : '教育背景'

    chunks.push({
      id: `exp-${exp.id}`,
      title: `经历：${exp.organization}（${exp.role}）[${kindLabel}]`,
      category: expCategory,
      content: `【机构/公司】${exp.organization}\n【角色】${exp.role}\n【类型】${kindLabel}\n【时间】${exp.period}\n【主要职责与产出】${exp.summary}\n【核心亮点】\n${exp.bullets.map((b) => `- ${b}`).join('\n')}\n【涉及技术】${exp.technologies.join('、')}`,
      evidenceTag: `${exp.organization} · ${exp.role}`,
      keywords: [exp.organization, exp.role, exp.period, exp.kind, kindLabel, ...exp.technologies, ...exp.bullets],
    })
  }

  // 4. Add Awards & Honor Chunks
  chunks.push({
    id: 'awards-summary',
    title: '竞赛荣誉与学业奖项',
    category: 'award',
    content: awards
      .map((a) => `- ${a.title}（${a.level}，${a.period}）`)
      .join('\n'),
    evidenceTag: '国家级/省级竞赛荣誉记录',
    keywords: ['竞赛', '荣誉', '奖项', '国赛', '省赛', ...awards.map((a) => a.title)],
  })

  // 5. Add Skill Set Chunks
  chunks.push({
    id: 'skills-summary',
    title: '技术栈与能力图谱',
    category: 'skill',
    content: skillGroups
      .map((g) => `【${g.title}】${g.items.join('、')}`)
      .join('\n'),
    evidenceTag: '技术栈能力清单',
    keywords: ['技能', '技术栈', 'React', 'Vue', 'Go', 'TypeScript', 'Node.js', 'Python', 'RAG'],
  })

  // 6. Add Personal Background & Job Intent Chunks
  chunks.push({
    id: 'profile-intent',
    title: '个人基本信息与求职意向',
    category: 'intent',
    content: `【姓名】${profile.name} (Jaxson)\n【毕业年份】2027 届（深圳职业技术大学 大数据技术专业，GPA 3.67/4.0 前 5%）\n【期望岗位】AI 应用开发 / Web 全栈开发 / 前端开发工程师\n【工作地点】深圳（可线下到岗/实习）\n【联系方式】电话/微信：${profile.phone}，邮箱：${profile.email}，GitHub：${profile.github}`,
    evidenceTag: '张锦鹏个人履历与联系方式',
    keywords: ['张锦鹏', 'Jaxson', '求职', '意向', '电话', '微信', '邮箱', '深职大', 'GPA', '深圳'],
  })

  return chunks
}
