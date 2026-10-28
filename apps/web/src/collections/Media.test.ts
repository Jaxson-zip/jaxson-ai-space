import { expect, it, vi } from 'vitest'
import { Media } from './Media'

it('only exposes media referenced by currently public projects to anonymous readers', async () => {
  const find = vi.fn().mockResolvedValue({ docs: [{ coverImage: 12, demoVideo: 13 }, { coverImage: 12 }] })
  const result = await Media.access!.read!({ req: { user: null, payload: { find } } } as never)
  expect(result).toEqual({ id: { in: ['12', '13'] } })
  expect(find).toHaveBeenCalledWith(expect.objectContaining({ collection: 'projects', depth: 0, pagination: false, where: { visibility: { equals: 'public' } } }))
})
it('denies anonymous media when nothing public references it and lets the signed-in editor preview uploads', async () => {
  const find = vi.fn().mockResolvedValue({ docs: [] })
  expect(await Media.access!.read!({ req: { user: null, payload: { find } } } as never)).toBe(false)
  expect(await Media.access!.read!({ req: { user: { id: 1 }, payload: { find } } } as never)).toBe(true)
  expect(find).toHaveBeenCalledTimes(1)
})
