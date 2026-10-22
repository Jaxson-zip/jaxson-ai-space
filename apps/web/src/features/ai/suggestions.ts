export interface PublishedProject {
  title: string
  shortTitle?: string
}

export interface Suggestion {
  kind: 'general' | 'project'
  label: string
  prompt: string
}

const MAX_PROJECT_CHIPS = 3

// General questions must be answerable from any published CMS content.
const GENERAL: Suggestion[] = [
  { kind: 'general', label: '岗位 JD 匹配', prompt: '📋 请帮我做一下针对前端/全栈开发岗位的 JD 匹配分析' },
  { kind: 'general', label: '全部公开项目', prompt: '你有哪些公开项目？' },
  { kind: 'general', label: '实习经历', prompt: '你的实习经历是什么？做了哪些工作？' },
]

/** Project chips come from the published list, so an unpublished project never gets a dead-end question. */
export function buildSuggestions(projects: readonly PublishedProject[]): Suggestion[] {
  const projectChips = projects.slice(0, MAX_PROJECT_CHIPS).map((project) => {
    const name = (project.shortTitle || project.title).trim()
    return {
      kind: 'project' as const,
      // "待办备忘 (Todo Memo)" → "待办备忘": a chip needs the name, not the subtitle.
      label: name.replace(/\s*[（(].*$/, '') || name,
      // Avoid list words such as "介绍": the retriever would answer with every project.
      prompt: `「${project.title}」这个项目解决了什么问题，是怎么做的，结果如何？`,
    }
  })
  return [...GENERAL, ...projectChips]
}
