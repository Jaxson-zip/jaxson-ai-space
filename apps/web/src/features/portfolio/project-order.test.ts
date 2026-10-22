import { describe, expect, it } from 'vitest'
import { homeOrder, orderProjects, pickFeatured } from './project-order'

const doc = (slug: string, extra: { featured?: boolean | null; sortOrder?: number | null } = {}) => ({ slug, ...extra })
const slugs = (projects: { slug: string }[]) => projects.map((project) => project.slug)

describe('project order shared by the feed, the home page and the AI', () => {
  it('sorts by the owner sort number, blanks last, ties in creation order', () => {
    expect(slugs(orderProjects([doc('a'), doc('b', { sortOrder: 2 }), doc('c', { sortOrder: 1 }), doc('d'), doc('e', { sortOrder: 2 })])))
      .toEqual(['c', 'b', 'e', 'a', 'd'])
  })

  it('features at most two flagged projects, or the first two when none is flagged', () => {
    expect(slugs(pickFeatured([doc('a'), doc('b', { featured: true }), doc('c', { featured: true }), doc('d', { featured: true })]))).toEqual(['b', 'c'])
    expect(slugs(pickFeatured([doc('a'), doc('b'), doc('c')]))).toEqual(['a', 'b'])
    expect(pickFeatured([])).toEqual([])
  })

  it('puts the featured projects first, then the rest in order', () => {
    expect(slugs(homeOrder([doc('a', { sortOrder: 1 }), doc('b', { featured: true, sortOrder: 3 }), doc('c', { sortOrder: 2 })])))
      .toEqual(['b', 'a', 'c'])
  })
})
