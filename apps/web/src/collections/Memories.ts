import type { CollectionConfig } from 'payload'
import { createRevalidateHook, createDeleteRevalidateHook } from '../features/cms/revalidate-hook'

export const Memories: CollectionConfig = {
  slug: 'memories',
  labels: {
    singular: '长期记忆条目',
    plural: '长期记忆库',
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'status', 'evidenceTag', 'updatedAt'],
  },
  hooks: {
    afterChange: [createRevalidateHook(['/ai', '/studio'])],
    afterDelete: [createDeleteRevalidateHook(['/ai', '/studio'])],
  },
  fields: [
    {
      name: 'title',
      label: '记忆主题/事实概要',
      type: 'text',
      required: true,
    },
    {
      name: 'category',
      label: '记忆分类',
      type: 'select',
      required: true,
      defaultValue: 'project_experience',
      options: [
        { label: '🚀 项目技术亮点与方案', value: 'project_experience' },
        { label: '🏢 企业实习与业务沉淀', value: 'internship_business' },
        { label: '💡 架构设计与认知模型', value: 'architecture_thinking' },
        { label: '⚠️ 踩坑记录与避坑方案', value: 'pitfall_solution' },
        { label: '🎯 待提升技能与目标', value: 'skill_gap_goal' },
      ],
    },
    {
      name: 'status',
      label: '审批状态',
      type: 'select',
      required: true,
      defaultValue: 'candidate',
      options: [
        { label: '⏳ 待确认候选记忆 (Candidate)', value: 'candidate' },
        { label: '🔒 已确认正式记忆 (Approved)', value: 'approved' },
        { label: '📦 已归档 (Archived)', value: 'archived' },
      ],
    },
    {
      name: 'content',
      label: '结构化记忆内容',
      type: 'textarea',
      required: true,
    },
    {
      name: 'evidenceTag',
      label: '证据溯源标签',
      type: 'text',
      required: true,
      defaultValue: '本人复盘提炼',
    },
    {
      name: 'confidence',
      label: '置信度',
      type: 'number',
      min: 0,
      max: 1,
      defaultValue: 0.95,
    },
    {
      name: 'sourceReflectionId',
      label: '关联复盘记录 ID',
      type: 'text',
    },
    {
      name: 'tags',
      label: '关键词标签',
      type: 'json',
    },
  ],
}
