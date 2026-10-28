import type { CollectionConfig } from 'payload'
import {
  createPublicIndexChangeHook,
  createPublicIndexDeleteHook,
  createRevalidateHook,
  createDeleteRevalidateHook,
} from '../features/cms/revalidate-hook'

export const Projects: CollectionConfig = {
  slug: 'projects',
  labels: {
    singular: '作品 / 项目经历',
    plural: '📁 作品与项目经历',
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'featured', 'sortOrder', 'status', 'visibility', 'updatedAt'],
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
    afterChange: [createRevalidateHook(['/', '/projects/[slug]']), createPublicIndexChangeHook('project')],
    afterDelete: [createDeleteRevalidateHook(['/', '/projects/[slug]']), createPublicIndexDeleteHook('project')],
  },
  fields: [
    {
      name: 'title',
      label: '项目名称',
      type: 'text',
      required: true,
    },
    {
      name: 'shortTitle',
      label: '作品页短标题（可选）',
      type: 'text',
    },
    {
      name: 'projectDate',
      label: '项目时间（例如 2026.05）',
      type: 'text',
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
      name: 'featured',
      label: '首页精选',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: '勾选后在首页 AI 对话里被引用（最多 2 个；都不勾选时取排在最前的 2 个），并排在作品区最前面。',
      },
    },
    {
      name: 'sortOrder',
      label: '排序',
      type: 'number',
      admin: {
        position: 'sidebar',
        description: '数字小的排在前面；留空的排在最后，按创建时间先后。',
      },
    },
    {
      name: 'visibility',
      label: '公开属性',
      type: 'select',
      defaultValue: 'private',
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
      admin: {
        description: '首页 AI 对话只引用前 36 个字，作品卡片上最多显示两行；建议 30 字以内，说清做了什么。',
      },
    },
    {
      name: 'coverImage',
      label: '项目封面图',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: '作品卡片和项目弹窗都会显示它：建议上传 16:10 的真实界面截图（例如 1440×900），从左上角开始裁切。不上传时显示项目名首字和技术栈。',
      },
    },
    {
      name: 'demoVideo',
      label: '演示视频',
      type: 'upload',
      relationTo: 'media',
      filterOptions: { mimeType: { contains: 'video' } },
      admin: {
        description: '点开作品卡片后在弹窗左边静音循环播放，封面图作为加载前的画面。建议 16:10 的 mp4（H.264），1 分钟以内、30 MB 以下。不上传时弹窗显示封面图。',
      },
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
      name: 'editorialNote',
      label: '项目档案补充说明（可选）',
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
