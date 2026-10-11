import { afterEach, describe, expect, it, vi } from 'vitest'
import { getIndexEmbeddingConfig, embedIndexText } from '../../../../scripts/lib/index-embedding.mjs'
import { generate1536Vector } from '@/features/worker/sync-worker'

afterEach(() => vi.unstubAllGlobals())

describe('shared index embeddings', () => {
  it('uses the existing local vector space without calling a provider', async () => {
    const request = vi.fn()
    vi.stubGlobal('fetch', request)
    const config = getIndexEmbeddingConfig({})
    const result = await embedIndexText('项目测试', config)
    expect(result.vector).toEqual(generate1536Vector('项目测试'))
    expect(result.modelKey).toBe('local-hash-v1:1536')
    expect(request).not.toHaveBeenCalled()
  })

  it('requires an explicit embedding key for semantic mode', () => {
    expect(() => getIndexEmbeddingConfig({ EMBEDDING_MODE: 'semantic' })).toThrow('EMBEDDING_API_KEY')
  })

  it('uses the configured model and normalizes a real provider vector', async () => {
    const vector = Array(1536).fill(0)
    vector[0] = 2
    const request = vi.fn().mockResolvedValue(Response.json({ data: [{ embedding: vector }] }))
    vi.stubGlobal('fetch', request)
    const config = getIndexEmbeddingConfig({ EMBEDDING_MODE: 'semantic', EMBEDDING_API_KEY: 'test-key' })
    const result = await embedIndexText('事实', config)
    expect(result.vector[0]).toBe(1)
    expect(result.modelKey).toContain('text-embedding-3-small')
    expect(JSON.parse(request.mock.calls[0][1].body)).toMatchObject({ input: '事实', dimensions: 1536 })
  })

  it.each([
    [1, 2], Array(1536).fill(0), Array(1536).fill('invalid'),
  ].map((vector) => ({ vector })))('rejects an invalid vector without mixing in hash vectors', async ({ vector }) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ data: [{ embedding: vector }] })))
    const config = getIndexEmbeddingConfig({ EMBEDDING_MODE: 'semantic', EMBEDDING_API_KEY: 'test-key' })
    await expect(embedIndexText('事实', config)).rejects.toThrow('embedding')
  })

  it('does not include provider error bodies or keys in failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('secret-provider-body', { status: 401 })))
    const config = getIndexEmbeddingConfig({ EMBEDDING_MODE: 'semantic', EMBEDDING_API_KEY: 'test-key' })
    await expect(embedIndexText('事实', config)).rejects.toThrow('HTTP 401')
  })
})
