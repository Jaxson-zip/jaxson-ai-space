import {
  profile as fallbackProfile,
  experiences as fallbackExperiences,
  projects as fallbackProjects,
  skillGroups as fallbackSkillGroups,
  awards as fallbackAwards,
} from './content'
import type { Experience, Project } from './types'
import cinematicProjects from './cinematic-projects.json'
import { safeExternalUrl } from './urls'

const knownCoverBySlug = new Map(
  cinematicProjects.map((project) => [project.slug, `/assets/${project.image}`]),
)

export async function getHydratedPortfolioData(
  { allowStaticFallback = true, projectSlug }: { allowStaticFallback?: boolean; projectSlug?: string } = {},
) {
  try {
    const { getPayload } = await import('payload')
    const { default: configPromise } = await import('@/payload.config')
    const payload = await getPayload({ config: configPromise })

    // Query active database records (Strictly filter visibility = 'public' for public portfolio)
    const projectsDocs = await payload.find({
      collection: 'projects',
      overrideAccess: false,
      limit: projectSlug ? 1 : 0,
      pagination: Boolean(projectSlug),
      sort: 'createdAt',
      where: {
        visibility: {
          equals: 'public',
        },
        ...(projectSlug ? { slug: { equals: projectSlug } } : {}),
      },
    })
    const experiencesDocs = await payload.find({
      collection: 'experiences',
      limit: 50,
      sort: 'createdAt',
    })
    const credentialsDocs = await payload.find({
      collection: 'credentials',
      limit: 100,
      sort: 'createdAt',
    })

    const projects: Project[] =
      projectsDocs.totalDocs > 0
        ? projectsDocs.docs.map((doc: any) => ({
            slug: doc.slug || String(doc.id),
            title: doc.title,
            category: doc.category || '全栈工程 · 真实交付',
            sourceVisibility: (doc.visibility as 'public' | 'private') || 'public',
            status: doc.status || '已上线',
            role: doc.role || '独立开发',
            summary: doc.summary || '',
            problem: doc.problem || '',
            approach: doc.approach || '',
            outcome: doc.outcome || '',
            technologies: (doc.tags || []).map((t: any) => t.tag || '').filter(Boolean),
            image:
              typeof doc.coverImage === 'object' && doc.coverImage?.url
                ? doc.coverImage.url
                : knownCoverBySlug.get(doc.slug)
                  ? knownCoverBySlug.get(doc.slug)!
                  : doc.slug === 'jaxson-ai-space' || doc.slug === 'space'
                    ? '/assets/jaxson-ai-space-cover.png'
                    : doc.slug === 'ruili-resume' || doc.slug === 'ruili'
                      ? '/assets/ruili-cover.svg'
                      : doc.slug === 'opc-agent-company' || doc.slug === 'opc'
                        ? '/assets/opc-cover.svg'
                        : doc.slug === 'todo-memo'
                          ? '/assets/todo-memo-cover.png'
                          : '/assets/project-dossier-cover.svg',
            links: [
              ...(safeExternalUrl(doc.demoUrl)
                ? [{ label: '在线体验', href: safeExternalUrl(doc.demoUrl), kind: 'live' as const }]
                : []),
              ...(safeExternalUrl(doc.repoUrl)
                ? [{ label: 'GitHub 源码', href: safeExternalUrl(doc.repoUrl), kind: 'source' as const }]
                : []),
            ],
          }))
        : allowStaticFallback ? fallbackProjects.filter((p) => p.sourceVisibility === 'public') : []

    const experiences: Experience[] =
      experiencesDocs.totalDocs > 0
        ? experiencesDocs.docs.map((doc: any) => ({
            id: String(doc.id),
            organization: doc.organization,
            role: doc.role,
            period: doc.period,
            summary: doc.description || '',
            bullets: (doc.bullets || []).map((b: any) => b.bullet || '').filter(Boolean),
            technologies: (doc.tags || []).map((t: any) => t.tag || '').filter(Boolean),
            kind: (doc.type as 'internship' | 'education' | 'campus' | 'other') || 'internship',
          }))
        : allowStaticFallback ? [...fallbackExperiences] : []

    const awardDocs = credentialsDocs.docs.filter((d: any) => d.category === 'award')
    const awards =
      awardDocs.length > 0
        ? awardDocs.map((d: any) => ({
            id: String(d.id),
            period: d.year || '',
            title: d.name,
            level: d.level || '',
          }))
        : allowStaticFallback ? fallbackAwards : []

    const skillDocs = credentialsDocs.docs.filter((d: any) => d.category === 'skill')
    const skillGroups =
      skillDocs.length > 0
        ? skillDocs.map((d: any) => ({
            id: String(d.id),
            title: d.name,
            items:
              typeof d.items === 'string'
                ? d.items
                    .split(/[,，、]/)
                    .map((s: string) => s.trim())
                    .filter(Boolean)
                : [],
          }))
        : allowStaticFallback ? fallbackSkillGroups : []

    return {
      profile: fallbackProfile,
      projects,
      experiences,
      skillGroups,
      awards,
      isLiveDb: true,
    }
  } catch (error) {
    console.warn('[Payload CMS] Falling back to static data due to:', error)
  }

  return {
    profile: fallbackProfile,
    projects: allowStaticFallback ? fallbackProjects.filter((p) => p.sourceVisibility === 'public') : [],
    experiences: allowStaticFallback ? fallbackExperiences : [],
    skillGroups: allowStaticFallback ? fallbackSkillGroups : [],
    awards: allowStaticFallback ? fallbackAwards : [],
    isLiveDb: false,
  }
}
