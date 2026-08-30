import type { CollectionConfig } from 'payload'

export const Credentials: CollectionConfig = {
  slug: 'credentials',
  labels: {
    singular: '荣誉技能',
    plural: '🏆 竞赛荣誉与技能',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'category', 'year', 'level'],
  },
  access: {
    read: () => true,
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      name: 'name',
      label: '荣誉 / 技能分类名称',
      type: 'text',
      required: true,
    },
    {
      name: 'category',
      label: '类型',
      type: 'select',
      options: [
        { label: '竞赛荣誉 (Award)', value: 'award' },
        { label: '技能分类 (Skill)', value: 'skill' },
        { label: '证书认证 (Certificate)', value: 'certificate' },
      ],
      required: true,
    },
    {
      name: 'year',
      label: '年份周期 (如 2025 — 2026)',
      type: 'text',
    },
    {
      name: 'level',
      label: '级别 / 奖项说明 (如 一等奖 / 国家级)',
      type: 'text',
    },
    {
      name: 'items',
      label: '包含项 / 工具列表',
      type: 'textarea',
    },
  ],
}
