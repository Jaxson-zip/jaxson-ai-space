import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import fallbackProjects from '@/features/portfolio/cinematic-projects.json'
import { safeExternalUrl } from '@/features/portfolio/urls'
import { orderProjects } from '@/features/portfolio/project-order'
import { allowPortfolioOrigin, portfolioPreflight } from '@/features/portfolio/cors'

export const dynamic = 'force-dynamic'

const coverBySlug = new Map(fallbackProjects.map((project) => [project.slug, project.image]))

const headersFor = (origin: string | null) => allowPortfolioOrigin(new Headers({ 'Cache-Control': 'no-store' }), origin)

export async function OPTIONS(request: Request) {
  return portfolioPreflight(request, 'GET, OPTIONS')
}

export async function GET(request: Request) {
  const headers = headersFor(request.headers.get('origin'))
  try {
    const payload = await getPayload({ config: configPromise })
    const result = await payload.find({
      collection: 'projects',
      overrideAccess: false,
      depth: 1,
      pagination: false,
      sort: 'createdAt',
      where: { visibility: { equals: 'public' } },
    })

    // Sorted here rather than in the query because SQLite and PostgreSQL place empty values differently.
    const ordered = orderProjects(result.docs)

    const projects = ordered.map((doc) => {
      const uploadedImage =
        typeof doc.coverImage === 'object' && doc.coverImage?.url
          ? new URL(doc.coverImage.url, request.url).href
          : null
      return {
        slug: doc.slug,
        title: doc.title,
        shortTitle: doc.shortTitle || doc.title,
        featured: doc.featured === true,
        category: doc.category,
        role: doc.role,
        date: doc.projectDate || '',
        status: doc.status,
        summary: doc.summary,
        problem: doc.problem || '',
        action: doc.approach || '',
        outcome: doc.outcome || '',
        note: doc.editorialNote || '',
        technologies: (doc.tags || []).map((entry) => entry.tag).filter(Boolean),
        image: uploadedImage || coverBySlug.get(doc.slug) || 'project-dossier-cover.svg',
        demoUrl: safeExternalUrl(doc.demoUrl),
        repoUrl: safeExternalUrl(doc.repoUrl),
      }
    })
    return Response.json({ source: 'cms', projects }, { headers })
  } catch (error) {
    console.error('[Showcase] CMS unavailable', error)
    return Response.json(
      { error: 'Project data is temporarily unavailable' },
      { status: 503, headers },
    )
  }
}
