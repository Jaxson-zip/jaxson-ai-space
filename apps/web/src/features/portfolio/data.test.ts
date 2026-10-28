import { describe, expect, it, vi } from 'vitest'

vi.mock('payload', () => ({
  getPayload: async () => ({
    find: async (options: {
      collection: string
      where: { visibility: { equals: string }; slug?: { equals: string } }
      pagination?: boolean
      limit: number
    }) => {
      if (options.collection !== 'projects') return { docs: [], totalDocs: 0 }
      let docs = Array.from({ length: 60 }, (_, index) => ({
        id: index + 1, slug: `project-${index + 1}`, title: `Project ${index + 1}`,
        visibility: index === 59 ? 'private' : 'public',
        role: '产品设计与 AI 协作开发', editorialNote: '负责产品定位与交互方向，借助 AI 完成代码实现。',
      })).filter((doc) => doc.visibility === options.where.visibility.equals)
      const slug = options.where.slug?.equals
      if (slug) docs = docs.filter((doc) => doc.slug === slug)
      return { docs: options.pagination === false ? docs : docs.slice(0, options.limit), totalDocs: docs.length }
    },
  }),
}))
vi.mock('@/payload.config', () => ({ default: Promise.resolve({}) }))

import { getHydratedPortfolioData } from './data'

describe('project detail lookup', () => {
  it('provides all published projects to the AI knowledge loader', async () => {
    const data = await getHydratedPortfolioData({ allowStaticFallback: false })
    expect(data.projects).toHaveLength(59)
  })

  it('finds a published project beyond the first 50 records', async () => {
    const data = await getHydratedPortfolioData({ allowStaticFallback: false, projectSlug: 'project-59' })
    expect(data.projects.find((project) => project.slug === 'project-59')?.title).toBe('Project 59')
  })

  it('does not expose a private project by its slug', async () => {
    const data = await getHydratedPortfolioData({ allowStaticFallback: false, projectSlug: 'project-60' })
    expect(data.projects).toEqual([])
  })

  it('preserves the published participation note for project pages and AI', async () => {
    const data = await getHydratedPortfolioData({ allowStaticFallback: false, projectSlug: 'project-1' })
    expect(data.projects[0]).toMatchObject({
      role: '产品设计与 AI 协作开发',
      note: '负责产品定位与交互方向，借助 AI 完成代码实现。',
    })
  })
})
