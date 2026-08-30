import { revalidatePath } from 'next/cache'
import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

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
