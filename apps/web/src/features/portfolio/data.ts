import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import {
  profile as fallbackProfile,
  experiences as fallbackExperiences,
  projects as fallbackProjects,
  skillGroups as fallbackSkillGroups,
  awards as fallbackAwards,
} from './content'
import type { Experience, Project } from './types'

export async function getHydratedPortfolioData() {
  try {
    const payload = await getPayload({ config: configPromise })

    // Query active database records (Strictly filter visibility = 'public' for public portfolio)
    const projectsDocs = await payload.find({
      collection: 'projects',
      limit: 50,
      sort: 'createdAt',
      where: {
        visibility: {
          equals: 'public',
        },
      },
    })
    const experiencesDocs = await payload.find({ collection: 'experiences', limit: 50, sort: 'createdAt' })

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
            image: typeof doc.coverImage === 'object' && doc.coverImage?.url
              ? doc.coverImage.url
              : doc.slug === 'ruili-resume' || doc.slug === 'ruili'
              ? '/assets/ruili-cover.svg'
              : doc.slug === 'opc-agent-company' || doc.slug === 'opc'
              ? '/assets/opc-cover.svg'
              : '/assets/todo-memo-cover.png',
            links: [
              ...(doc.demoUrl ? [{ label: '在线体验', href: doc.demoUrl, kind: 'live' as const }] : []),
              ...(doc.repoUrl ? [{ label: 'GitHub 源码', href: doc.repoUrl, kind: 'source' as const }] : []),
            ],
          }))
        : fallbackProjects.filter((p) => p.sourceVisibility === 'public')

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
        : [...fallbackExperiences]

    return {
      profile: fallbackProfile,
      projects,
      experiences,
      skillGroups: fallbackSkillGroups,
      awards: fallbackAwards,
      isLiveDb: true,
    }
  } catch (error) {
    console.warn('[Payload CMS] Falling back to static data due to:', error)
    return {
      profile: fallbackProfile,
      projects: fallbackProjects.filter((p) => p.sourceVisibility === 'public'),
      experiences: fallbackExperiences,
      skillGroups: fallbackSkillGroups,
      awards: fallbackAwards,
      isLiveDb: false,
    }
  }
}
