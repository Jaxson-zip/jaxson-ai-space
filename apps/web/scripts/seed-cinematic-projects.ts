/** Seed only missing, PDF-backed projects in the local Payload CMS. */
import { getPayload } from 'payload'
import configPromise from '../src/payload.config'
import projects from '../src/features/portfolio/cinematic-projects.json'

if (process.env.USE_POSTGRES === 'true') {
  throw new Error('This one-time seed is local SQLite only.')
}

const payload = await getPayload({ config: configPromise })

for (const project of projects) {
  const existing = await payload.find({
    collection: 'projects',
    overrideAccess: true,
    limit: 1,
    where: { slug: { equals: project.slug } },
  })
  if (existing.totalDocs > 0) {
    const current = existing.docs[0]
    const updates: Record<string, string> = {}
    if (!current.shortTitle) updates.shortTitle = project.shortTitle
    if (!current.projectDate) updates.projectDate = project.date
    if (!current.editorialNote && project.note) updates.editorialNote = project.note
    // Correct the initial local seed's overstatement without touching later CMS edits.
    if (project.slug === 'ruili-resume' && current.status === '已开源并上线') {
      updates.status = project.status
      updates.outcome = project.outcome
    }
    if (Object.keys(updates).length) {
      await payload.update({ collection: 'projects', id: current.id, overrideAccess: true, data: updates })
      console.log(`Filled missing CMS fields: ${project.slug}`)
    }
    console.log(`Kept existing CMS project: ${project.slug}`)
    continue
  }
  await payload.create({
    collection: 'projects',
    overrideAccess: true,
    data: {
      title: project.title,
      shortTitle: project.shortTitle,
      projectDate: project.date,
      slug: project.slug,
      role: project.role,
      category: project.category as
        | '工具应用 · 原型落地'
        | '求职工具 · 开源二次开发'
        | 'AI 产品 · 私有概念探索'
        | '全栈工程 · 真实交付',
      visibility: 'public',
      status: project.status,
      summary: project.summary,
      problem: project.problem,
      approach: project.action,
      outcome: project.outcome,
      editorialNote: project.note,
      tags: project.technologies.map((tag) => ({ tag })),
      demoUrl: project.demoUrl,
      repoUrl: project.repoUrl,
    },
  })
  console.log(`Created CMS project: ${project.slug}`)
}

process.exit(0)
