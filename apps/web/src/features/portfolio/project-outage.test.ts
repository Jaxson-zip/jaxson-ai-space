import { expect, it, vi } from 'vitest'
vi.mock('./data', () => ({ getHydratedPortfolioData: vi.fn() }))
import { getHydratedPortfolioData } from './data'
import ProjectDetail, { generateMetadata } from '@/app/(frontend)/projects/[slug]/page'

it('reports unavailable project data as an error rather than a missing project', async () => {
  vi.mocked(getHydratedPortfolioData).mockResolvedValue({ projects: [], isLiveDb: false } as never)
  await expect(ProjectDetail({ params: Promise.resolve({ slug: 'existing' }) })).rejects.toThrow('项目资料暂时无法加载')
  await expect(generateMetadata({ params: Promise.resolve({ slug: 'existing' }) })).rejects.toThrow('项目资料暂时无法加载')
})
it('keeps a real missing project as 404 when the CMS query succeeds', async () => {
  vi.mocked(getHydratedPortfolioData).mockResolvedValue({ projects: [], isLiveDb: true } as never)
  await expect(ProjectDetail({ params: Promise.resolve({ slug: 'missing' }) })).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404')
})
