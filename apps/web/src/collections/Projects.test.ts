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

  const upSql = async (name: RegExp) => {
    const migration = migrations.find((entry) => name.test(entry.name))!
    const statements: string[] = []
    await migration.up({ db: { execute: async (query: unknown) => { statements.push(JSON.stringify(query)) } } } as never)
    return statements.join('\n')
  }

  it('ships a production migration for the home-order columns', async () => {
    const sql = await upSql(/_project_home_order$/)
    expect(sql).toContain('ADD COLUMN \\"featured\\" boolean DEFAULT false')
    expect(sql).toContain('ADD COLUMN \\"sort_order\\" numeric')
  })

  it('takes an optional demo video from the media library, for the project dialog on the home page', () => {
    const field = Projects.fields.find((entry) => 'name' in entry && entry.name === 'demoVideo') as Record<string, unknown> & { admin?: { description?: string } }
    expect(field).toMatchObject({ type: 'upload', relationTo: 'media', filterOptions: { mimeType: { contains: 'video' } } })
    expect(field.required).toBeFalsy()
    expect(field.admin?.description).toMatch(/mp4/)
  })

  it('ships the demo video column as the latest migration, linked to media like the cover', async () => {
    expect(migrations.at(-1)!.name).toMatch(/_project_demo_video$/)
    const sql = await upSql(/_project_demo_video$/)
    expect(sql).toContain('ADD COLUMN \\"demo_video_id\\" integer')
    expect(sql).toContain('REFERENCES \\"owner\\".\\"media\\"(\\"id\\") ON DELETE set null')
    expect(sql).toContain('CREATE INDEX \\"projects_demo_video_idx\\"')
  })
})
