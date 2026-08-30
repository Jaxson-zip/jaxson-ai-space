import type { CollectionConfig } from 'payload'
import { createRevalidateHook, createDeleteRevalidateHook } from '../features/cms/revalidate-hook'

export const Experiences: CollectionConfig = {
  slug: 'experiences',
  labels: {
    singular: '经历记录',
    plural: '💼 工作与实践经历',
  },
  admin: {
    useAsTitle: 'organization',
    defaultColumns: ['organization', 'role', 'period', 'type'],
  },
  access: {
    read: () => true,
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  hooks: {
    afterChange: [createRevalidateHook(['/', '/resume'])],
    afterDelete: [createDeleteRevalidateHook(['/', '/resume'])],
  },
  fields: [
    {
      name: 'organization',
      label: '机构 / 公司名称',
      type: 'text',
      required: true,
    },
    {
      name: 'role',
      label: '岗位职位',
      type: 'text',
      required: true,
    },
    {
      name: 'period',
      label: '时间周期 (如 2026.06 — 2026.08)',
      type: 'text',
      required: true,
    },
    {
      name: 'type',
      label: '经历类型',
      type: 'select',
      options: [
        { label: '企业实习 (Internship)', value: 'internship' },
        { label: '教育背景 (Education)', value: 'education' },
        { label: '校园实践 (Campus)', value: 'campus' },
      ],
      required: true,
    },
    {
      name: 'description',
      label: '概述说明',
      type: 'textarea',
    },
    {
      name: 'bullets',
      label: '具体工作产出要点',
      type: 'array',
      labels: {
        singular: '产出项',
        plural: '工作产出列表',
      },
      fields: [
        {
          name: 'bullet',
          label: '要点内容',
          type: 'text',
        },
      ],
    },
    {
      name: 'tags',
      label: '关联技术栈',
      type: 'array',
      labels: {
        singular: '技术栈',
        plural: '技术栈列表',
      },
      fields: [
        {
          name: 'tag',
          label: '技术名',
          type: 'text',
        },
      ],
    },
  ],
}
