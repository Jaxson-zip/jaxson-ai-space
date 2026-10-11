import { describe, expect, it, vi } from 'vitest'

const { records } = vi.hoisted(() => ({
  records: Array.from({ length: 105 }, (_, index) => ({
    id: index + 1,
    slug: `project-${index + 1}`,
    title: `Project ${index + 1}`,
    visibility: index === 104 ? 'private' : 'public',
  })),
}))

vi.mock('payload', () => ({
  getPayload: async () => ({
    find: async (options: {
      where: { visibility: { equals: string } }
      pagination?: boolean
      limit?: number
    }) => {
      const docs = records.filter((record) => record.visibility === options.where.visibility.equals)
      return { docs: options.pagination === false ? docs : docs.slice(0, options.limit) }
    },
  }),
}))
vi.mock('@/payload.config', () => ({ default: Promise.resolve({}) }))

import { GET } from '@/app/api/showcase-projects/route'

describe('public project archive', () => {
  it('returns projects beyond the first 100 while excluding private projects', async () => {
    const response = await GET(new Request('https://api.example.test/api/showcase-projects'))
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.projects).toHaveLength(104)
    expect(result.projects.at(-1).slug).toBe('project-104')
    expect(result.projects.some((project: { slug: string }) => project.slug === 'project-105')).toBe(false)
  })
})
