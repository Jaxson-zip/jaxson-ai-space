import type { CollectionConfig } from 'payload'
import { createRevalidateHook, createDeleteRevalidateHook } from '../features/cms/revalidate-hook'

export const Projects: CollectionConfig = {
  slug: 'projects',
  labels: {
    singular: '作品项目',
    plural: '📁 作品与项目库',
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'status', 'visibility', 'updatedAt'],
  },
  access: {
    read: ({ req }) => {
      if (req.user) return true
      return {
        visibility: {
          equals: 'public',
        },
      }
    },
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  hooks: {
    afterChange: [createRevalidateHook(['/', '/projects/[slug]'])],
    afterDelete: [createDeleteRevalidateHook(['/', '/projects/[slug]'])],
  },
  fields: [
    {
      name: 'title',
      label: '项目名称',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      label: 'URL 别名 (Slug)',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'role',
      label: '角色与定位',
      type: 'text',
      required: true,
    },
    {
      name: 'category',
      label: '项目分类',
      type: 'select',
      options: [
        { label: '工具应用 · 原型落地', value: '工具应用 · 原型落地' },
        { label: '求职工具 · 开源二次开发', value: '求职工具 · 开源二次开发' },
        { label: 'AI 产品 · 私有概念探索', value: 'AI 产品 · 私有概念探索' },
        { label: '全栈工程 · 真实交付', value: '全栈工程 · 真实交付' },
      ],
      required: true,
    },
    {
      name: 'visibility',
      label: '公开属性',
      type: 'select',
      defaultValue: 'public',
      options: [
        { label: '公开展示 (Public)', value: 'public' },
        { label: '私有探索 (Private)', value: 'private' },
      ],
      required: true,
    },
    {
      name: 'status',
      label: '状态标签 (如 已上线 PWA / 已开源 / 持续迭代)',
      type: 'text',
      required: true,
    },
    {
      name: 'summary',
      label: '一句话简介',
      type: 'textarea',
      required: true,
    },
    {
      name: 'coverImage',
      label: '项目封面图',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'tags',
      label: '技术标签',
      type: 'array',
      labels: {
        singular: '标签',
        plural: '技术栈标签列表',
      },
      fields: [
        {
          name: 'tag',
          label: '标签名 (如 React, Supabase)',
          type: 'text',
        },
      ],
    },
    {
      name: 'problem',
      label: '💡 业务痛点与初衷',
      type: 'textarea',
    },
    {
      name: 'approach',
      label: '🛠️ 技术方案与实现重点',
      type: 'textarea',
    },
    {
      name: 'outcome',
      label: '📈 交付成果与当前状态',
      type: 'textarea',
    },
    {
      name: 'highlights',
      label: '技术亮点要点清单',
      type: 'array',
      labels: {
        singular: '亮点',
        plural: '亮点要点列表',
      },
      fields: [
        {
          name: 'item',
          label: '亮点描述',
          type: 'text',
        },
      ],
    },
    {
      name: 'demoUrl',
      label: '在线访问 Demo 链接',
      type: 'text',
    },
    {
      name: 'repoUrl',
      label: 'GitHub 源码仓库链接',
      type: 'text',
    },
  ],
}
