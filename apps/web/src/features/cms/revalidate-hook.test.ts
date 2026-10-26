import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { queries } = vi.hoisted(() => ({ queries: [] as unknown[][] }))
vi.mock('pg', () => ({
  Pool: class {
    query(_sql: string, params: unknown[]) { queries.push(params); return Promise.resolve({ rows: [] }) }
    end() { return Promise.resolve() }
  },
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
import { createPublicIndexChangeHook, createPublicIndexDeleteHook } from './revalidate-hook'

const project = { title: 'Todo Memo', category: 'tool', visibility: 'public', summary: '项目摘要', problem: 'p', approach: 'a', outcome: 'o', tags: [] }
const run = (doc: object, previousDoc?: object) => createPublicIndexChangeHook('project')({
  doc, previousDoc, req: { payload: { logger: { warn: vi.fn() } } },
} as never)

beforeEach(() => {
  queries.length = 0
  vi.stubEnv('USE_POSTGRES', 'true')
  vi.stubEnv('DATABASE_URI', 'postgres://index-test')
})
afterEach(() => vi.unstubAllEnvs())

describe('public index events for projects', () => {
  it('indexes the required summary when optional project details are blank', async () => {
    const summary = '支持离线记账和自动分类的开源工具。'
    await run({
      ...project, slug: 'offline-ledger', role: '独立开发', status: '已上线', summary,
      problem: '', approach: '', outcome: '',
    })

    expect(queries).toHaveLength(1)
    expect(queries[0][0]).toBe('PROJECT_PUBLISHED')
    expect(queries[0][4]).toContain(summary)
  })

  it('retires the old slug when a published project is renamed', async () => {
    await run({ ...project, slug: 'todo-memo-v2' }, { ...project, slug: 'todo-memo' })
    expect(queries.map(([event, entity]) => [event, entity])).toEqual([
      ['PROJECT_UNPUBLISHED', 'proj-todo-memo'],
      ['PROJECT_PUBLISHED', 'proj-todo-memo-v2'],
    ])
    expect(queries[0][4]).toBe('')
  })

  it('keeps private project summaries out of unpublished events', async () => {
    await run({ ...project, slug: 'todo-memo', visibility: 'private' }, { ...project, slug: 'todo-memo' })

    expect(queries).toHaveLength(1)
    expect(queries[0][0]).toBe('PROJECT_UNPUBLISHED')
    expect(queries[0][4]).toBe('')
  })

  it('keeps deleted project summaries out of unpublished events', async () => {
    await createPublicIndexDeleteHook('project')({
      doc: { ...project, slug: 'todo-memo' }, req: { payload: { logger: { warn: vi.fn() } } },
    } as never)

    expect(queries).toHaveLength(1)
    expect(queries[0][0]).toBe('PROJECT_UNPUBLISHED')
    expect(queries[0][4]).toBe('')
  })

  it('queues a single event when the slug is unchanged', async () => {
    await run({ ...project, slug: 'todo-memo' }, { ...project, slug: 'todo-memo' })
    expect(queries.map(([event, entity]) => [event, entity])).toEqual([['PROJECT_PUBLISHED', 'proj-todo-memo']])
  })

  it('queues a single event for a newly created project', async () => {
    await run({ ...project, slug: 'todo-memo' })
    expect(queries).toHaveLength(1)
  })
})
