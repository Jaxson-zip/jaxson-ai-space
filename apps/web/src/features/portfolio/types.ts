export interface Profile {
  readonly name: string
  readonly title: string
  readonly location: string
  readonly availability: string
  readonly summary: string
  readonly phone: string
  readonly email: string
  readonly github: string
}

export interface Experience {
  readonly id: string
  readonly organization: string
  readonly role: string
  readonly period: string
  readonly summary: string
  readonly bullets: readonly string[]
  readonly technologies: readonly string[]
  readonly kind: 'internship' | 'education' | 'campus' | 'other'
}

export interface ProjectLink {
  readonly label: string
  readonly href: string
  readonly kind: 'live' | 'source'
}

export interface Project {
  readonly slug: string
  readonly title: string
  readonly category: string
  readonly sourceVisibility: 'public' | 'private'
  readonly status: string
  readonly summary: string
  readonly problem: string
  readonly approach: string
  readonly outcome: string
  readonly role: string
  readonly technologies: readonly string[]
  readonly image: string | null
  readonly links: readonly ProjectLink[]
}

export interface Award {
  readonly id: string
  readonly period: string
  readonly title: string
  readonly level: string
}

export interface SkillGroup {
  readonly id: string
  readonly title: string
  readonly items: readonly string[]
}
