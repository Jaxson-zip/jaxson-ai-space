import type { CollectionConfig } from 'payload'
import { createRevalidateHook, createDeleteRevalidateHook } from '../features/cms/revalidate-hook'

export const AIKnowledge: CollectionConfig = {
  slug: 'ai-knowledge',
  labels: {
    singular: 'AI 知识条目',
    plural: '🧠 AI 数字分身知识库',
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'isPublic', 'updatedAt'],
  },
  access: {
    read: ({ req }) => {
      if (req.user) return true
      return {
        isPublic: {
          equals: true,
        },
      }
    },
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  hooks: {
    afterChange: [createRevalidateHook(['/ai'])],
    afterDelete: [createDeleteRevalidateHook(['/ai'])],
  },
  fields: [
    {
      name: 'title',
      label: '知识条目 / 问答主题',
      type: 'text',
      required: true,
    },
    {
      name: 'category',
      label: '知识分类',
      type: 'select',
      options: [
        { label: '实习产出事实 (Internship Fact)', value: 'internship' },
        { label: '项目技术架构 (Project Architecture)', value: 'project' },
        { label: '技能与工具掌握 (Skills & Mastery)', value: 'skill' },
        { label: '教育与竞赛事实 (Education & Awards)', value: 'education' },
        { label: '岗位 JD 匹配规则 (JD Match Rules)', value: 'jd_match' },
      ],
      required: true,
    },
    {
      name: 'content',
      label: '真实事实知识内容 (用于 RAG 检索)',
      type: 'textarea',
      required: true,
    },
    {
      name: 'isPublic',
      label: '是否对公开 AI 分身可见',
      type: 'checkbox',
      defaultValue: true,
    },
    {
      name: 'evidenceTag',
      label: '证据引用标签 (如 广东润喵云实习经历)',
      type: 'text',
    },
  ],
}
