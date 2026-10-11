import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCmsClient, exportContent, importContent, type CmsRecord } from '../../../scripts/lib/cms-transfer.mjs'

afterEach(() => vi.unstubAllGlobals())

const project = { id: 91, slug: 'example', title: '真实项目', visibility: 'public', role: '开发', category: '全栈工程 · 真实交付', status: '已上线', summary: '摘要' }

describe('portable CMS content', () => {
  it('reads every API page and refuses to send credentials to external cover hosts', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(Response.json({ token: 'test-token' }))
      .mockResolvedValueOnce(Response.json({ docs: [{ id: 1 }], hasNextPage: true }))
      .mockResolvedValueOnce(Response.json({ docs: [{ id: 2 }], hasNextPage: false }))
    vi.stubGlobal('fetch', request)
    const client = await createCmsClient('https://cms.example.test', 'owner@example.test', 'test-password')
    expect(await client.list('projects')).toHaveLength(2)
    await expect(client.media!('https://other.example.test/cover.jpg')).rejects.toThrow('CMS origin')
    expect(request).toHaveBeenCalledTimes(3)
  })

  it('exports content without source record IDs or administrator data', async () => {
    const client = { list: vi.fn(async (collection: string) => collection === 'projects' ? [project] : []) }
    const archive = await exportContent(client)
    expect(archive.records.projects[0]).toMatchObject({ slug: 'example', title: '真实项目' })
    expect(archive.records.projects[0]).not.toHaveProperty('id')
    expect(Object.keys(archive.records)).not.toContain('users')
    expect(client.list.mock.calls.some(([collection]) => collection === 'users')).toBe(false)
  })

  it('does not write during a dry run and skips existing records on repeated imports', async () => {
    const client = { list: vi.fn(async (): Promise<CmsRecord[]> => []), write: vi.fn(), upload: vi.fn() }
    const archive = await exportContent({ list: async (collection: string) => collection === 'projects' ? [project] : [] })
    const preview = await importContent(client, archive)
    expect(preview.created).toBe(1)
    expect(client.write).not.toHaveBeenCalled()
    client.list.mockImplementation(async () => [project])
    const applied = await importContent(client, archive, { apply: true })
    expect(applied.skipped).toBe(1)
    expect(client.write).not.toHaveBeenCalled()
  })

  it('remaps source media IDs to the target CMS instead of reusing them', async () => {
    const client = {
      list: async () => [],
      upload: vi.fn(async () => ({ id: 777 })),
      write: vi.fn(async () => ({ id: 888 })),
    }
    const source = {
      list: async (collection: string) => collection === 'projects' ? [{ ...project, coverImage: { id: 12, url: '/cover.jpg', filename: 'cover.jpg', mimeType: 'image/jpeg', alt: '项目图' } }] : [],
      media: async () => new Uint8Array([1, 2, 3]),
    }
    const archive = await exportContent(source)
    await importContent(client, archive, { apply: true })
    expect(client.write).toHaveBeenCalledWith('projects', expect.objectContaining({ coverImage: 777 }), undefined)
  })
})
