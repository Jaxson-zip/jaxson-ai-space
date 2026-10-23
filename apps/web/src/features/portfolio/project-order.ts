// One project order for the public feed, the home page and the AI twin, so all three name the same work first.
// apps/portfolio/index.html repeats pickFeatured in plain JavaScript; keep the two in step.

interface Orderable {
  featured?: boolean | null
  sortOrder?: number | null
}

const MAX_FEATURED = 2

/** The owner's sort number first (blanks last); equal numbers keep the incoming (creation) order. */
export function orderProjects<T extends Orderable>(projects: readonly T[]): T[] {
  const rank = (value: number | null | undefined) => (typeof value === 'number' ? value : Infinity)
  return projects
    .map((project, index) => ({ project, index }))
    .sort((a, b) => rank(a.project.sortOrder) - rank(b.project.sortOrder) || a.index - b.index)
    .map(({ project }) => project)
}

/** At most two flagged projects; without any flag, the first two stand in. */
export function pickFeatured<T extends Orderable>(ordered: readonly T[]): T[] {
  const flagged = ordered.filter((project) => project.featured === true)
  return (flagged.length ? flagged : ordered).slice(0, MAX_FEATURED)
}

/** The home page order: featured projects, then the rest in the owner's order. */
export function homeOrder<T extends Orderable>(projects: readonly T[]): T[] {
  const ordered = orderProjects(projects)
  const featured = pickFeatured(ordered)
  return [...featured, ...ordered.filter((project) => !featured.includes(project))]
}
