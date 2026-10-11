import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import { getHydratedPortfolioData } from '@/features/portfolio/data'
import { embedIndexText, getIndexEmbeddingConfig, LOCAL_MODEL_KEY } from '../../../../scripts/lib/index-embedding.mjs'
import { getPgPool } from './db-pool'
import type { ChunkCategory, KnowledgeChunk } from './types'

export async function loadKnowledgeChunks(query?: string): Promise<KnowledgeChunk[]> {
  const chunks: KnowledgeChunk[] = []
  const indexedScores = new Map<string, number>()
  let indexedSource: 'local' | 'semantic' = 'local'

  // 1. Try querying PostgreSQL public_read.knowledge_embeddings snapshot (Strict Least Privilege)
  const isProd = process.env.NODE_ENV === 'production'
  const pgConnStr = process.env.PUBLIC_AGENT_DATABASE_URI || (!isProd ? process.env.DATABASE_URI : undefined)

  if (process.env.USE_POSTGRES === 'true' && pgConnStr) {
    try {
      const pool = getPgPool(pgConnStr)
      const embeddingConfig = getIndexEmbeddingConfig()
      indexedSource = embeddingConfig.mode
      const queryVector = query?.trim()
        ? `[${(await embedIndexText(query, embeddingConfig)).vector.join(',')}]`
        : null
      const res = await pool.query(`
          SELECT chunk_id, category, title, content, evidence_tag, metadata,
                 CASE WHEN embedding IS NULL THEN NULL
                      ELSE 1 - (embedding <=> COALESCE($1::vector, embedding))
                 END AS vector_score
          FROM public_read.knowledge_embeddings 
          WHERE is_active = TRUE
            AND COALESCE(metadata->>'embeddingModel', $3) = $2
          ORDER BY embedding <=> COALESCE($1::vector, embedding) NULLS LAST, updated_at DESC
          LIMIT 100
        `, [queryVector, embeddingConfig.modelKey, LOCAL_MODEL_KEY])
      for (const row of res.rows) {
        const entityId = row.metadata?.entityId
        const score = Number(row.vector_score)
        if (typeof entityId === 'string' && row.vector_score != null && Number.isFinite(score)) {
          indexedScores.set(entityId, Math.max(indexedScores.get(entityId) ?? 0, Math.max(0, Math.min(1, score))))
        }
      }
    } catch {
      console.warn('[RAG] Public vector lookup unavailable; using current public CMS records')
    }
  }

  // Public CMS records are the source of truth. The index only supplies relevance scores.
  try {
    const payload = await getPayload({ config: configPromise })
    const aiKnowledgeDocs = await payload.find({
      collection: 'ai-knowledge',
      pagination: false,
      where: {
        isPublic: {
          equals: true,
        },
      },
    })

    for (const doc of aiKnowledgeDocs.docs) {
      chunks.push({
        id: `cms-${doc.id}`,
        title: doc.title,
        category: doc.category as ChunkCategory,
        content: doc.content,
        evidenceTag: doc.evidenceTag || `知识库条目：${doc.title}`,
        keywords: [doc.title, doc.category, doc.evidenceTag || ''].filter(Boolean),
        vectorScore: indexedScores.get(`knowledge-${doc.id}`),
        vectorSource: indexedScores.has(`knowledge-${doc.id}`) ? indexedSource : 'local',
      })
    }
  } catch {
    console.warn('[RAG] Public CMS knowledge lookup unavailable')
  }

  // Chat may only cite live CMS records. The portfolio's static display fallback is not evidence.
  const { projects, experiences, awards, skillGroups } = await getHydratedPortfolioData({
    allowStaticFallback: false,
  })

  // 3. Add Project Chunks (Strictly filter public projects only)
  for (const p of projects.filter((proj) => proj.sourceVisibility === 'public')) {
    chunks.push({
      id: `project-${p.slug}`,
      title: `项目：${p.title}`,
      category: 'project',
      content: `【项目背景】${p.problem}\n【技术方案】${p.approach}\n【交付结果】${p.outcome}\n【技术栈】${p.technologies.join('、')}\n【状态】${p.status}${p.links.some((link) => link.kind === 'source') ? '（有公开源码）' : ''}`,
      evidenceTag: `项目档案：${p.title}`,
      keywords: [p.title, p.slug, p.category, ...p.technologies, p.status],
      vectorScore: indexedScores.get(`proj-${p.slug}`),
      vectorSource: indexedScores.has(`proj-${p.slug}`) ? indexedSource : 'local',
    })
  }

  // 4. Add Experience Chunks (Properly distinguish internship, education, campus)
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

  // 5. Add Awards & Honor Chunks
  if (awards.length > 0) {
    chunks.push({
      id: 'awards-summary',
      title: '竞赛荣誉与学业奖项',
      category: 'award',
      content: awards
        .map((a) => `- ${a.title}（${a.level}，${a.period}）`)
        .join('\n'),
      evidenceTag: 'CMS 竞赛与学业奖项',
      keywords: ['竞赛', '荣誉', '奖项', '国赛', '省赛', ...awards.map((a) => a.title)],
    })
  }

  // 6. Add Skill Set Chunks
  if (skillGroups.length > 0) {
    chunks.push({
      id: 'skills-summary',
      title: '技术栈与能力图谱',
      category: 'skill',
      content: skillGroups
        .map((g) => `【${g.title}】${g.items.join('、')}`)
        .join('\n'),
      evidenceTag: 'CMS 技术栈与技能记录',
      keywords: ['技能', '技术栈', ...skillGroups.flatMap((g) => [g.title, ...g.items])],
    })
  }

  return chunks
}
