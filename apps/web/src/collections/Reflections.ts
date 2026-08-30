import type { CollectionConfig } from 'payload'

export const Reflections: CollectionConfig = {
  slug: 'reflections',
  labels: {
    singular: '个人复盘记录',
    plural: '个人复盘记录',
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'type', 'date', 'extractionStatus', 'createdAt'],
  },
  fields: [
    {
      name: 'title',
      label: '复盘主题',
      type: 'text',
      required: true,
    },
    {
      name: 'type',
      label: '复盘类型',
      type: 'select',
      required: true,
      defaultValue: 'daily',
      options: [
        { label: '📅 每日工作/学习复盘', value: 'daily' },
        { label: '📊 每周总结复盘', value: 'weekly' },
        { label: '💼 面试与沟通复盘', value: 'interview' },
        { label: '🚀 技术攻坚与复盘', value: 'technical' },
      ],
    },
    {
      name: 'date',
      label: '复盘日期',
      type: 'date',
      required: true,
      defaultValue: () => new Date().toISOString().slice(0, 10),
    },
    {
      name: 'content',
      label: '主要工作内容与进展',
      type: 'textarea',
      required: true,
    },
    {
      name: 'challenges',
      label: '遇到的难点与挑战',
      type: 'textarea',
    },
    {
      name: 'solution',
      label: '解决方案与技术手段',
      type: 'textarea',
    },
    {
      name: 'takeaways',
      label: '心得收获与核心认知',
      type: 'textarea',
    },
    {
      name: 'nextSteps',
      label: '后续行动与跟进待办',
      type: 'textarea',
    },
    {
      name: 'extractionStatus',
      label: '候选记忆提炼状态',
      type: 'select',
      defaultValue: 'pending',
      options: [
        { label: '待提炼', value: 'pending' },
        { label: '已提炼', value: 'extracted' },
        { label: '无需提炼', value: 'skipped' },
      ],
    },
  ],
}
