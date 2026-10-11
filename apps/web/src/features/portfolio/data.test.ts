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
})
