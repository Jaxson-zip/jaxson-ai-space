import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath, URL as NodeUrl } from 'node:url'

import { describe, expect, it } from 'vitest'

import { awards, experiences, profile, projects, skillGroups } from './content'
import type { Award, Experience, Profile, Project, ProjectLink, SkillGroup } from './types'

type IfEquals<Left, Right, Then = true, Else = false> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? Then
    : Else
type WritableKeys<Value> = {
  [Key in keyof Value]-?: IfEquals<Pick<Value, Key>, Readonly<Pick<Value, Key>>, never, Key>
}[keyof Value]
type ExpectNever<Value extends never> = Value
type ExpectTrue<Value extends true> = Value
type IsReadonlyArray<Value extends readonly unknown[]> = Value extends unknown[] ? false : true
type IsStringLiteral<Value extends string> = string extends Value ? false : true

type _DtoPropertiesAreReadonly = ExpectNever<
  | WritableKeys<Profile>
  | WritableKeys<Experience>
  | WritableKeys<ProjectLink>
  | WritableKeys<Project>
  | WritableKeys<Award>
  | WritableKeys<SkillGroup>
>
type _NestedCollectionsAreReadonly = [
  ExpectTrue<IsReadonlyArray<Experience['bullets']>>,
  ExpectTrue<IsReadonlyArray<Experience['technologies']>>,
  ExpectTrue<IsReadonlyArray<Project['technologies']>>,
  ExpectTrue<IsReadonlyArray<Project['links']>>,
  ExpectTrue<IsReadonlyArray<SkillGroup['items']>>,
]
type _ContentIdentifiersStayLiteral = [
  ExpectTrue<IsStringLiteral<(typeof experiences)[number]['id']>>,
  ExpectTrue<IsStringLiteral<(typeof projects)[number]['slug']>>,
  ExpectTrue<IsStringLiteral<(typeof awards)[number]['id']>>,
  ExpectTrue<IsStringLiteral<(typeof skillGroups)[number]['id']>>,
]

const typedExperiences: readonly Experience[] = experiences
const typedProjects: readonly Project[] = projects
const publicDirectory = fileURLToPath(new NodeUrl('../../../public/', import.meta.url))

function expectUniqueStableIds(values: readonly string[]) {
  expect(values.length).toBeGreaterThan(0)
  for (const value of values) {
    expect(value.trim()).not.toBe('')
  }
  expect(new Set(values).size).toBe(values.length)
}

describe('portfolio content', () => {
  it('identifies the profile owner', () => {
    expect(profile.name).toBe('张锦鹏')
  })

  it('exposes the expected projects in display order', () => {
    expect(projects.map((project) => project.slug)).toEqual([
      'todo-memo',
      'ruili-resume',
      'opc-agent-company',
    ])
  })

  it('marks exactly one project as private', () => {
    expect(typedProjects.filter((project) => project.sourceVisibility === 'private')).toHaveLength(
      1,
    )
  })

  it('documents the problem, approach, and outcome for every project', () => {
    for (const project of projects) {
      expect(project.problem.trim()).not.toBe('')
      expect(project.approach.trim()).not.toBe('')
      expect(project.outcome.trim()).not.toBe('')
    }
  })

  it('does not expose source links for private projects', () => {
    const privateProjects = typedProjects.filter(
      (project) => project.sourceVisibility === 'private',
    )

    for (const project of privateProjects) {
      expect(project.links.some((link) => link.kind === 'source')).toBe(false)
    }
  })

  it('records the completed internship period', () => {
    const internship = typedExperiences.find(
      (experience) => experience.id === 'runmiaoyun-internship',
    )

    expect(internship?.period).toBe('2026.06 - 2026.08')
  })

  it('classifies the Zhuhai placement as an internship', () => {
    const internship = typedExperiences.find(
      (experience) => experience.id === 'zhuhai-vocational-internship',
    )

    expect(internship?.kind).toBe('internship')
  })

  it('records the approved student leadership roles', () => {
    const education = experiences.find(
      (experience) => experience.organization === '深圳职业技术大学',
    )

    expect(education?.bullets).toContain(
      '担任院学信委人工智能学院副主席、班级学习委员、甲骨文社团社长。',
    )
  })

  it('exposes non-empty unique identifiers for every collection', () => {
    expectUniqueStableIds(typedExperiences.map((experience) => experience.id))
    expectUniqueStableIds(typedProjects.map((project) => project.slug))
    expectUniqueStableIds(awards.map((award) => award.id))
    expectUniqueStableIds(skillGroups.map((skillGroup) => skillGroup.id))
  })

  it('uses valid external links with allowed protocols and non-empty destinations', () => {
    const externalLinks = [
      profile.github,
      ...typedProjects.flatMap((project) => project.links),
    ].map((link) => (typeof link === 'string' ? link : link.href))
    const allowedProtocols = ['https:', 'mailto:', 'tel:']

    expect(externalLinks.length).toBeGreaterThan(0)
    for (const href of externalLinks) {
      expect(() => new NodeUrl(href)).not.toThrow()

      const url = new NodeUrl(href)
      expect(allowedProtocols).toContain(url.protocol)

      if (url.protocol === 'https:') {
        expect(url.hostname.trim()).not.toBe('')
      } else {
        expect(url.pathname.trim()).not.toBe('')
      }
    }
  })

  it('references public assets that exist on disk', () => {
    for (const project of typedProjects) {
      if (project.image !== null) {
        const imagePath = resolve(publicDirectory, project.image.replace(/^\/+/, ''))
        expect(existsSync(imagePath), `Missing project image: ${project.image}`).toBe(true)
      }
    }

    const resumePath = resolve(publicDirectory, 'resume', 'zhang-jinpeng-resume.docx')
    expect(existsSync(resumePath), 'Missing public resume asset').toBe(true)
  })
})
