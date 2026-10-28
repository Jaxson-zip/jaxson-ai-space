import type { CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
  slug: 'media',
  labels: {
    singular: '媒体图片',
    plural: '🖼️ 图片与媒体中心',
  },
  access: {
    read: async ({ req }) => {
      if (req.user) return true
      // Covers and videos become public only while a published project references them.
      // depth: 0 avoids recursively reading media while checking its own access.
      const projects = await req.payload.find({
        collection: 'projects', req, overrideAccess: true, depth: 0, pagination: false,
        where: { visibility: { equals: 'public' } }, select: { coverImage: true, demoVideo: true },
      })
      const ids = new Set<string>()
      for (const project of projects.docs) {
        for (const media of [project.coverImage, project.demoVideo]) {
          const id = typeof media === 'object' && media !== null ? media.id : media
          if (id !== undefined && id !== null) ids.add(String(id))
        }
      }
      return ids.size ? { id: { in: [...ids] } } : false
    },
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      name: 'alt',
      label: '图片描述 (Alt 文本)',
      type: 'text',
      required: true,
    },
  ],
  upload: process.env.MEDIA_DIR ? { staticDir: process.env.MEDIA_DIR } : true,
}
