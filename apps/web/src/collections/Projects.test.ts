import { describe, expect, it } from 'vitest'
import { Projects } from './Projects'
import { migrations } from '../migrations'

describe('projects collection', () => {
  it('lets the owner feature projects on the home page and order them', () => {
    const field = (name: string) => Projects.fields.find((entry) => 'name' in entry && entry.name === name)
    expect(field('featured')).toMatchObject({ type: 'checkbox', defaultValue: false })
    expect(field('sortOrder')).toMatchObject({ type: 'number' })
  })

  it('tells the editor how the summary and cover are shown on the home page', () => {
    const description = (name: string) => {
      const entry = Projects.fields.find((field) => 'name' in field && field.name === name) as { admin?: { description?: unknown } }
      return String(entry?.admin?.description ?? '')
    }
    expect(description('summary')).toMatch(/36/)
    expect(description('coverImage')).toMatch(/16:10/)
  })

  it('ships a production migration for the new columns', async () => {
    const latest = migrations.at(-1)!
    expect(latest.name).toMatch(/_project_home_order$/)
    const statements: string[] = []
    const sqlChunks = (query: { queryChunks?: unknown[] }) => JSON.stringify(query)
    await latest.up({ db: { execute: async (query: { queryChunks?: unknown[] }) => { statements.push(sqlChunks(query)) } } } as never)
    const sql = statements.join('\n')
    expect(sql).toContain('ADD COLUMN \\"featured\\" boolean DEFAULT false')
    expect(sql).toContain('ADD COLUMN \\"sort_order\\" numeric')
  })
})
