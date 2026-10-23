import { describe, expect, it } from 'vitest'
import { buildSuggestions } from './suggestions'
import { groundedRetrieve } from './rag/retriever'

describe('AI page suggestions', () => {
  it('offers questions only about projects that are actually published', () => {
    const suggestions = buildSuggestions([
      { title: '待办备忘 (Todo Memo)', shortTitle: '待办备忘 (Todo Memo)' },
      { title: 'Jaxson AI Space (本站 · 全栈个人门户与 AI 分身)', shortTitle: 'Jaxson AI Space (本站 · 全栈个人门户与 AI 分身)' },
    ])
    const projectPrompts = suggestions.filter((item) => item.kind === 'project').map((item) => item.prompt)
    expect(projectPrompts).toEqual([
      '「待办备忘 (Todo Memo)」这个项目解决了什么问题，是怎么做的，结果如何？',
      '「Jaxson AI Space (本站 · 全栈个人门户与 AI 分身)」这个项目解决了什么问题，是怎么做的，结果如何？',
    ])
    expect(suggestions.map((item) => item.prompt).join(' ')).not.toMatch(/锐历|Nutrinet/)
  })

  it('asks about one project rather than triggering the all-projects list', () => {
    const [chip] = buildSuggestions([{ title: '待办备忘 (Todo Memo)' }]).filter((item) => item.kind === 'project')
    const chunks = [
      { id: 'a', title: '项目：待办备忘 (Todo Memo)', category: 'project' as const, content: '离线任务', evidenceTag: 'a', keywords: ['待办备忘'] },
      { id: 'b', title: '项目：Jaxson AI Space', category: 'project' as const, content: '个人门户', evidenceTag: 'b', keywords: ['Jaxson AI Space'] },
    ]
    expect(groundedRetrieve(chip.prompt, chunks).map((result) => result.chunk.id)).toEqual(['a'])
  })

  it('keeps chip labels short and limits the number of project chips', () => {
    const suggestions = buildSuggestions(Array.from({ length: 5 }, (_, index) => ({ title: `项目${index} (长说明)` })))
    const labels = suggestions.filter((item) => item.kind === 'project').map((item) => item.label)
    expect(labels).toEqual(['项目0', '项目1', '项目2'])
  })

  it('asks about the featured projects first, like the home page', () => {
    const suggestions = buildSuggestions([
      { title: '项目甲' }, { title: '项目乙', featured: true }, { title: '项目丙' }, { title: '项目丁', featured: true },
    ])
    expect(suggestions.filter((item) => item.kind === 'project').map((item) => item.label)).toEqual(['项目乙', '项目丁', '项目甲'])
  })

  it('still offers general questions when no project list is available', () => {
    const labels = buildSuggestions([]).map((item) => item.label)
    expect(labels).toEqual(['岗位 JD 匹配', '全部公开项目', '实习经历'])
  })
})
