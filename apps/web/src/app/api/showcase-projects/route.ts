import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import fallbackProjects from '@/features/portfolio/cinematic-projects.json'
import { safeExternalUrl } from '@/features/portfolio/urls'

export const dynamic = 'force-dynamic'

const coverBySlug = new Map(fallbackProjects.map((project) => [project.slug, project.image]))

function headersFor(origin: string | null) {
  const headers = new Headers({ 'Cache-Control': 'no-store' })
  const portfolioOrigin = process.env.NEXT_PUBLIC_PORTFOLIO_URL
  const allowedOrigins = new Set([
    portfolioOrigin ? new URL(portfolioOrigin).origin : '',
    'http://localhost:4174',
    'http://127.0.0.1:4174',
  ])
  if (origin && allowedOrigins.has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin)
    headers.set('Vary', 'Origin')
  }
  return headers
}

export async function OPTIONS(request: Request) {
  const headers = headersFor(request.headers.get('origin'))
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
  return new Response(null, { status: 204, headers })
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

    const projects = result.docs.map((doc) => {
      const uploadedImage =
        typeof doc.coverImage === 'object' && doc.coverImage?.url
          ? new URL(doc.coverImage.url, request.url).href
          : null
      return {
        slug: doc.slug,
        title: doc.title,
        shortTitle: doc.shortTitle || doc.title,
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
