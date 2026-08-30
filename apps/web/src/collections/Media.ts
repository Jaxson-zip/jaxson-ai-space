import type { CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
  slug: 'media',
  labels: {
    singular: '媒体图片',
    plural: '🖼️ 图片与媒体中心',
  },
  access: {
    read: () => true,
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
  upload: true,
}
