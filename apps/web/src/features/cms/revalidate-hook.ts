import { revalidatePath } from 'next/cache'
import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'
import { Pool } from 'pg'

type PublicIndexKind = 'project' | 'knowledge'

async function enqueuePublicIndexEvent(kind: PublicIndexKind, doc: Record<string, any>, deleted = false) {
  if (process.env.USE_POSTGRES !== 'true' || !process.env.DATABASE_URI) return

  const isPublic = kind === 'project' ? doc.visibility === 'public' : doc.isPublic === true
  const eventType = deleted || !isPublic
    ? kind === 'project' ? 'PROJECT_UNPUBLISHED' : 'KNOWLEDGE_REMOVED'
    : kind === 'project' ? 'PROJECT_PUBLISHED' : 'KNOWLEDGE_ADDED'
  const tags = Array.isArray(doc.tags)
    ? doc.tags.map((tag: any) => typeof tag === 'string' ? tag : tag?.tag || '').filter(Boolean)
    : []
  const content = deleted || !isPublic
    ? ''
    : kind === 'project'
    ? `【项目背景】${doc.problem || ''}\n【技术方案】${doc.approach || ''}\n【交付结果】${doc.outcome || ''}\n【技术栈】${tags.join('、')}`
    : String(doc.content || '')
  const pool = new Pool({ connectionString: process.env.DATABASE_URI, max: 1, idleTimeoutMillis: 5000 })
  try {
    await pool.query(
      `INSERT INTO owner.outbox_events
       (event_type, entity_id, title, category, content, evidence_tag)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        eventType,
        kind === 'project'
          ? `proj-${String(doc.slug || doc.id)}`
          : `knowledge-${String(doc.slug || doc.id)}`,
        String(doc.title || doc.name || doc.id),
        String(doc.category || 'general'),
        content,
        String(doc.evidenceTag || `${kind}:${doc.title || doc.id}`),
      ],
    )
  } finally {
    await pool.end().catch(() => {})
  }
}

export const createPublicIndexChangeHook = (kind: PublicIndexKind): CollectionAfterChangeHook => {
  return async ({ doc, req }) => {
    try {
      await enqueuePublicIndexEvent(kind, doc)
    } catch (err) {
      req.payload.logger.warn(`[Public Index] Failed to enqueue ${kind} change: ${err}`)
    }
    return doc
  }
}

export const createPublicIndexDeleteHook = (kind: PublicIndexKind): CollectionAfterDeleteHook => {
  return async ({ doc, req }) => {
    try {
      await enqueuePublicIndexEvent(kind, doc, true)
    } catch (err) {
      req.payload.logger.warn(`[Public Index] Failed to enqueue ${kind} deletion: ${err}`)
    }
    return doc
  }
}

/**
 * On-demand Revalidation Hook for Payload CMS Collections
 * 
 * Automatically purges Next.js ISR/SSG cache when content is created, updated, or deleted.
 */
export const createRevalidateHook = (paths: string[]): CollectionAfterChangeHook => {
  return async ({ doc, operation, req }) => {
    try {
      // Revalidate specified public paths
      for (const path of paths) {
        if (path.includes('[slug]') && doc?.slug) {
          const dynamicPath = path.replace('[slug]', String(doc.slug))
          revalidatePath(dynamicPath)
        } else {
          revalidatePath(path)
        }
      }
      req.payload.logger.info(`[Revalidation] Cleared cache for paths: ${paths.join(', ')} (operation: ${operation})`)
    } catch (err) {
      req.payload.logger.warn(`[Revalidation] Failed to revalidate paths: ${err}`)
    }
    return doc
  }
}

export const createDeleteRevalidateHook = (paths: string[]): CollectionAfterDeleteHook => {
  return async ({ doc, req }) => {
    try {
      for (const path of paths) {
        if (path.includes('[slug]') && doc?.slug) {
          const dynamicPath = path.replace('[slug]', String(doc.slug))
          revalidatePath(dynamicPath)
        } else {
          revalidatePath(path)
        }
      }
      req.payload.logger.info(`[Revalidation] Cleared cache on delete for paths: ${paths.join(', ')}`)
    } catch (err) {
      req.payload.logger.warn(`[Revalidation] Failed to revalidate delete: ${err}`)
    }
    return doc
  }
}
